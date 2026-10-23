'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { Lock, DoorOpen, MessageCircle, Search } from 'lucide-react';
import { walkingPath, advanceWalk, turnTowards } from '@/lib/walking';
import { routeGuidance } from '@/lib/route-guide';
import { isEasterEgg } from '@/lib/easter-eggs';
import { mailMotion } from '@/lib/mail-motion';
import { targets, roomObstacles } from '@/lib/scene-layout';
import type { SceneTarget } from '@/lib/scene-layout';
import type { WorldState, Room } from '@/lib/world-state';
type Props = {
    state: WorldState;
    cover?: boolean;
    reduceMotion?: boolean;
    paused?: boolean;
    sending?: boolean;
    activeTarget?: string | null;
    suggestedTarget?: string | null;
    guidanceRevision?: number;
    children?: ReactNode;
    onInspect?: (id: string) => void;
    onTravel?: (room: Room) => void;
    onWalk?: () => void;
    onStep?: () => void;
    onSendDone?: () => void;
    reaction?: {
        id: string;
        serial: number;
    };
    showLabels?: boolean;
    talked?: string[];
    onTransition?: (busy: boolean) => void;
    canEnter?: (room: Room) => boolean;
    previewFiles?: number;
    previewFan?: boolean;
    debugTemperature?: number;
    repairTarget?: string | null;
    discovered?: string[];
};
export function WorldScene(props: Props) {
    const { state, cover = false, activeTarget, children, sending = false } = props;
    const host = useRef<HTMLDivElement>(null), canvasHost = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null);
    const latest = useRef(props);
    latest.current = props;
    const coolingLayoutRef = useRef(state.repaired.server);
    if (props.previewFan === undefined)
        coolingLayoutRef.current = state.repaired.server;
    const coolingLayout = coolingLayoutRef.current;
    const controls = useRef<{
        move: (id: string, scripted?: boolean) => void;
        focus: (id: string | null) => void;
        stop: () => void;
    } | undefined>(undefined), last = useRef<{
        room: Room;
        x: number;
        z: number;
        heading: number;
        cover: boolean;
    } | null>(null);
    const objectTip = useRef<HTMLDivElement>(null), eggOverlay = useRef<HTMLDivElement>(null), talkOverlay = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false), [transition, setTransition] = useState<'leaving' | 'arriving' | null>(null), [attention, setAttention] = useState(true);
    useEffect(() => { setAttention(true); const id = setTimeout(() => setAttention(false), 9000); return () => clearTimeout(id); }, [state.room]);
    const visible = targets[state.room];
    useEffect(() => {
        const el = canvasHost.current;
        if (!el)
            return;
        let renderer: THREE.WebGLRenderer, disposed = false;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        }
        catch {
            setFailed(true);
            setTransition(null);
            latest.current.onTransition?.(false);
            return;
        }
        setFailed(false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x101d21, 0);
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-7, 7, 6, -6, .1, 80);
        camera.position.set(4.5, 12, 16);
        camera.lookAt(0, .5, 0);
        camera.updateMatrixWorld();
        scene.add(new THREE.HemisphereLight(0xb9e8e0, 0x283238, 2.6));
        const sun = new THREE.DirectionalLight(0xffd69b, 3.8);
        sun.position.set(-4, 13, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
        sun.shadow.bias = -.001;
        scene.add(sun);
        const materials: THREE.Material[] = [], geometries: THREE.BufferGeometry[] = [], textures: THREE.Texture[] = [];
        const mat = (color: number, emissive = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: .25, emissive, emissiveIntensity: .8 }); materials.push(m); return m; };
        const teal = mat(0x39686b), dark = mat(0x152e35), copper = mat(0xb77a4c), cream = mat(0xe0cda7), black = mat(0x0b2027), yellow = mat(0xf5bd60), mint = mat(0x9de8c9, 0x317e6a), red = mat(0xed7752, 0x772e1e), paper = mat(0xf6e5bf), blue = mat(0x376fa0), olive = mat(0x72985c), white = mat(0xdce9dd);
        const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x: number, y: number, z: number) => { geometries.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
        const box = (p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material) => mesh(new THREE.BoxGeometry(w, h, d), m, p, x, y, z);
        const cyl = (p: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, m: THREE.Material) => mesh(new THREE.CylinderGeometry(r, r, h, 16), m, p, x, y, z);
        const ball = (p: THREE.Object3D, x: number, y: number, z: number, r: number, m: THREE.Material) => mesh(new THREE.IcosahedronGeometry(r, 2), m, p, x, y, z);
        const ring = (p: THREE.Object3D, x: number, y: number, z: number, r: number, t: number, m: THREE.Material) => mesh(new THREE.TorusGeometry(r, t, 8, 32), m, p, x, y, z);
        const group = (p: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
        const room = new THREE.Group();
        scene.add(room);
        let forceFrame = true;
        const objectRoots = new Map<string, THREE.Object3D[]>();
        const bind = (id: string, ...roots: THREE.Object3D[]) => objectRoots.set(id, roots);
        const bindRecent = (id: string, start: number) => bind(id, ...room.children.slice(start));
        const corridor = state.room === 'corridor', width = 9;
        const label = (text: string, x: number, y: number, z: number, w = 1.5, parent: THREE.Object3D = room) => {
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 128;
            const ctx = c.getContext('2d')!;
            let content = text;
            const draw = () => { ctx.fillStyle = '#152d33'; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = '#b98b54'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 504, 120); ctx.fillStyle = '#f4deb5'; ctx.font = '500 44px Oswald,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(content, 256, 65, 474); };
            draw();
            const texture = new THREE.CanvasTexture(c);
            textures.push(texture);
            const m = new THREE.MeshBasicMaterial({ map: texture });
            materials.push(m);
            const p = mesh(new THREE.PlaneGeometry(w, w / 4), m, parent, x, y, z);
            p.castShadow = false;
            p.userData.setText = (value: string) => {
                if (content === value || disposed)
                    return;
                content = value;
                draw();
                texture.needsUpdate = true;
                forceFrame = true;
            };
            void document.fonts.load('500 44px Oswald').then(() => {
                if (!disposed) {
                    draw();
                    texture.needsUpdate = true;
                    forceFrame = true;
                }
            });
            return p;
        };
        // A thicker front apron holds the collected address plates.
        box(room, 0, -.49, 0, width, .95, 8, dark);
        box(room, 0, -1, 0, width + .18, .12, 8.18, copper);
        box(room, 0, -.4, 4.04, width - .2, .65, .12, teal);
        for (const x of [-width / 2 + .3, width / 2 - .3])
            for (const y of [-.18, -.69])
                ball(room, x, y, 4.13, .055, copper);
        const tileGeometry = new THREE.BoxGeometry(.96, .055, .96);
        geometries.push(tileGeometry);
        const tileMaterial = mat(state.room === 'archive' ? 0x4e5c4e : state.room === 'dispatch' ? 0x47636c : 0x3e5b5c);
        const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, Math.round(width) * 8), matrix = new THREE.Matrix4();
        let index = 0;
        for (let x = -width / 2 + .5; x < width / 2; x++)
            for (let z = -3.5; z < 4; z++) {
                matrix.makeTranslation(x, 0, z);
                tiles.setMatrixAt(index++, matrix);
            }
        tiles.receiveShadow = true;
        room.add(tiles);
        // Equal-height walls with visible pipework, panel seams and warm sconces.
        box(room, 0, 1.675, -3.8, width, 3.45, .25, teal);
        box(room, -width / 2 + .125, 1.675, 0, .25, 3.45, 7.75, teal);
        box(room, 0, 3.43, -3.8, width + .15, .12, .34, copper);
        box(room, -width / 2 + .125, 3.43, 0, .32, .12, 7.75, copper);
        for (let x = -width / 2 + .5; x < width / 2; x += 1.5) {
            box(room, x, 1.6, -3.65, .04, 3, .025, dark);
            ball(room, x, 3.15, -3.62, .045, copper);
        }
        for (const y of [.3, 3.05]) {
            const p = cyl(room, 0, y, -3.48, .07, width, copper);
            p.rotation.z = Math.PI / 2;
            const side = cyl(room, -width / 2 + .2, y, -.2, .07, 6.7, copper);
            side.rotation.x = Math.PI / 2;
        }
        for (const z of [-2.5, .3]) {
            box(room, -width / 2 + .21, 2.65, z, .16, .6, .38, dark);
            box(room, -width / 2 + .32, 2.65, z, .08, .42, .22, mint);
        }
        const lamp = group(room, state.room === 'server' ? -3.1 : width / 2 - 1, 3.18, -3.38);
        box(lamp, 0, 0, 0, 1.1, .15, .18, dark);
        box(lamp, 0, -.08, .01, .85, .05, .14, yellow);
        const blinkers: THREE.Object3D[] = [], npcs: {
            body: THREE.Group;
            head: THREE.Group;
            arms: THREE.Group[];
            phase: number;
        }[] = [];
        function robot(x: number, z: number, role: 'courier' | 'clerk' | 'engineer' | 'guard' | 'post') {
            const root = group(room, x, 0, z), body = group(root), uniform = role === 'post' ? blue : role === 'guard' ? dark : role === 'engineer' ? yellow : teal;
            root.scale.setScalar(role === 'courier' ? .8 : role === 'guard' ? 1.03 : .94);
            const legs = [-1, 1].map(i => { const leg = group(root, i * .22, 0, 0); box(leg, 0, .31, 0, .25, .45, .26, dark); box(leg, 0, .13, .09, .33, .19, .48, copper); return leg; });
            box(body, 0, .93, 0, .9, .84, .6, uniform);
            box(body, 0, .58, .01, .93, .11, .64, dark);
            const head = group(body, 0, 1.64, 0);
            box(head, 0, 0, 0, 1.15, .8, .74, cream);
            box(head, 0, .01, .4, .94, .53, .045, black);
            for (const i of [-1, 1]) {
                const eye = box(head, i * .22, .07, .44, role === 'guard' ? .21 : .15, role === 'clerk' ? .1 : .17, .028, mint);
                blinkers.push(eye);
            }
            box(head, 0, -.14, .44, role === 'post' ? .37 : .28, .035, .03, mint);
            const arms = [-1, 1].map(i => { const arm = group(body, i * .57, 1.2, 0); box(arm, 0, -.23, 0, .24, .5, .26, uniform); ball(arm, 0, -.52, .015, .14, copper); arm.rotation.z = i * .08; return arm; });
            if (role === 'courier') {
                box(body, .42, .82, .51, .66, .5, .36, copper);
                box(body, .42, .82, .71, .13, .51, .025, paper);
                box(body, 0, .86, -.44, .64, .7, .3, dark);
                box(head, 0, .43, 0, 1.18, .14, .8, teal);
                box(head, 0, .43, .48, .8, .06, .3, copper);
            }
            if (role === 'clerk') {
                for (const i of [-1, 1])
                    ring(head, i * .23, .06, .465, .21, .035, copper);
                box(head, 0, .06, .47, .1, .03, .025, copper);
                box(body, 0, 1.25, .34, .14, .15, .04, red);
                for (const i of [-1, 1]) {
                    const bow = box(body, i * .13, 1.25, .34, .2, .15, .045, red);
                    bow.rotation.z = i * .3;
                }
                cyl(head, 0, .57, 0, .13, .32, dark);
            }
            if (role === 'engineer') {
                const helmet = ball(head, 0, .32, 0, .65, yellow);
                helmet.scale.set(1, .42, .8);
                box(head, 0, .39, .1, 1.3, .1, .95, yellow);
                box(head, 0, .53, .17, .13, .16, .6, copper);
                for (const i of [-1, 1])
                    box(body, i * .27, .94, .32, .11, .66, .025, white);
                box(body, 0, .61, .37, .86, .13, .1, copper);
                box(body, .3, .65, .44, .08, .38, .1, cream);
                ring(body, .3, .88, .44, .11, .04, cream);
            }
            if (role === 'guard') {
                box(head, 0, .47, 0, 1.28, .2, .83, dark);
                box(head, 0, .43, .52, .95, .07, .4, black);
                box(head, 0, .57, .42, .22, .18, .025, yellow);
                for (const i of [-1, 1]) {
                    box(body, i * .5, 1.27, 0, .27, .08, .38, yellow);
                    const brow = box(head, i * .23, .24, .46, .3, .04, .03, cream);
                    brow.rotation.z = -i * .2;
                }
                const badge = ball(body, -.25, 1.04, .34, .13, yellow);
                badge.scale.z = .2;
                box(body, .3, .73, .36, .12, .57, .12, black);
            }
            if (role === 'post') {
                box(head, 0, .46, 0, 1.25, .17, .83, blue);
                box(head, 0, .43, .48, .92, .06, .3, blue);
                box(head, 0, .48, .44, .22, .12, .035, paper);
                box(body, 0, 1.13, .32, .9, .1, .035, white);
                box(body, -.24, .87, .34, .25, .18, .025, paper);
                box(body, .51, .63, .22, .38, .46, .43, copper);
            }
            if (role !== 'courier') {
                npcs.push({ body, head, arms, phase: npcs.length * 1.8 });
                bind(({ clerk: 'bot', engineer: 'engineer', guard: 'guard', post: 'postman' } as const)[role], root);
            }
            return { group: root, body, head, legs, arms };
        }
        const drawer = (x: number, z: number) => {
            box(room, x, .58, z, 1.35, 1.1, .9, copper);
            for (const y of [.3, .65, .98]) {
                box(room, x, y, z + .48, 1.2, .27, .07, teal);
                box(room, x, y, z + .55, .35, .05, .08, cream);
            }
        };
        let fan: THREE.Group | undefined, frog: THREE.Group | undefined, throat: THREE.Mesh | undefined, pigeon: THREE.Group | undefined, frogTongue: THREE.Mesh | undefined, bell: THREE.Group | undefined, temperatureLabel: THREE.Mesh | undefined, coolingStatusLabel: THREE.Mesh | undefined, overheatLight: THREE.PointLight | undefined;
        const wings: THREE.Group[] = [], flames: THREE.Mesh[] = [], steam: THREE.Mesh[] = [], coolingSignals: THREE.Mesh[] = [], doorLeaves = new Map<string, THREE.Object3D>();
        const coolingSignal = (o: THREE.Mesh) => {
            if (o.material instanceof THREE.MeshStandardMaterial) {
                o.material = o.material.clone();
                materials.push(o.material);
                coolingSignals.push(o);
            }
            return o;
        };
        // A rigid leaf rotates around its hinge; its handle remains attached.
        const hingeDoor = (id: string, leaf: THREE.Mesh, width: number) => { const parent = leaf.parent!; const pivot = group(parent, leaf.position.x - width / 2, leaf.position.y, leaf.position.z); leaf.position.set(width / 2, 0, 0); pivot.add(leaf); doorLeaves.set(id, pivot); return leaf; };
        const openDoor = (id: string, amount: number) => {
            const hinge = doorLeaves.get(id);
            if (hinge)
                hinge.rotation.y = -Math.PI * .53 * amount;
        };
        const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
        const smoke: THREE.Mesh[] = [], mailRollers: THREE.Mesh[] = [], pressureLights: THREE.Mesh[] = [];
        if (!corridor) {
            const door = group(room, -width / 2 + .18, 0, 2.55);
            door.rotation.y = Math.PI / 2;
            box(door, 0, 1.15, 0, 1.6, 2.3, .18, copper);
            box(door, 0, 1.1, .12, 1.36, 2.12, .07, dark);
            const leaf = hingeDoor('exit', box(door, 0, 1.17, .18, 1.1, 1.9, .05, teal), 1.1);
            box(leaf, .4, -.14, .05, .12, .24, .1, yellow);
            label('ВЫХОД', 0, 2.5, .17, 1.5, door);
            bind('exit', door);
        }
        if (corridor) {
            const entrances = [{ id: 'info', x: -2.7, z: -2.5, title: 'СПРАВКИ' }, { id: 'server', x: 0, z: -2.5, title: 'СЕРВЕРНАЯ' }, { id: 'gate', x: 2.7, z: -2.5, title: 'ОХРАНА' }, { id: 'dispatch', x: 4.2, z: .1, title: 'ПОЧТА' }];
            for (const { x, z, id, title } of entrances) {
                const frame = group(room, x, 0, z);
                if (id === 'dispatch')
                    frame.rotation.y = -Math.PI / 2;
                box(frame, 0, 1.35, 0, 1.95, 2.7, .3, copper);
                box(frame, 0, 1.28, .18, 1.65, 2.5, .12, black);
                const leaf = hingeDoor(id, box(frame, 0, 1.27, .27, 1.5, 2.4, .09, id === 'dispatch' ? blue : teal), 1.5);
                box(leaf, .45, 0, .09, .12, .18, .07, yellow);
                label(title, 0, 2.96, .25, 1.85, frame);
                bind(id, frame);
            }
            for (let z = -.8; z < 2.7; z += .5)
                box(room, -.5, .06, z, .09, .025, .26, yellow);
            box(room, -3.72, 1.32, 1.6, .7, .14, .6, copper);
            cyl(room, -3.72, .65, 1.6, .09, 1.3, copper);
            pigeon = group(room, -3.72, 1.8, 1.6);
            const feather = mat(0x7c969c), neck = mat(0x6a788f);
            const body = ball(pigeon, 0, 0, 0, .34, feather);
            body.scale.set(.85, 1.15, 1.1);
            const head = group(pigeon, 0, .41, .14);
            pigeon.userData.head = head;
            ball(head, 0, 0, 0, .24, neck);
            const beak = mesh(new THREE.ConeGeometry(.09, .27, 8), copper, head, 0, -.015, .31);
            beak.rotation.x = Math.PI / 2;
            for (const i of [-1, 1]) {
                ball(head, i * .16, .07, .16, .075, yellow);
                ball(head, i * .17, .075, .2, .042, black);
                const wing = group(pigeon, i * .25, .05, -.02);
                const feathers = ball(wing, i * .07, -.07, 0, .29, dark);
                feathers.scale.set(.3, 1, 1.2);
                wings.push(wing);
                box(pigeon, i * .13, -.42, .09, .07, .15, .07, copper);
                box(pigeon, i * .13, -.49, .17, .18, .05, .24, copper);
            }
            for (let i = -1; i <= 1; i++) {
                const tail = box(pigeon, i * .1, -.07, -.38, .1, .055, .35, feather);
                tail.rotation.x = -.3;
            }
            bind('pigeon', pigeon);
            label('ОБЛАЧНОЕ ХРАНЕНИЕ', -3.72, .85, 1.97, 1.2);
            const router = group(room, -4.08, 2.55, -.5);
            router.rotation.y = Math.PI / 2;
            box(router, 0, 0, 0, 1.2, .35, .28, dark);
            for (const x of [-.4, .4])
                cyl(router, x, .45, 0, .035, .6, black);
            for (let i = 0; i < 4; i++)
                ball(router, -.3 + i * .2, .01, .17, .035, mint);
            bind('router', router);
        }
        else if (state.room === 'info') {
            robot(-2, -1.3, 'clerk');
            drawer(1, -.7);
            box(room, -2, .6, -.25, 2.4, 1.1, .65, dark);
            label('РЕГ-01', -2, .95, .1, 1.7);
            for (let i = 0; i < 4; i++) {
                const sheet = box(room, -1.4, 1.17 + i * .04, -.22, .55, .03, .37, paper);
                sheet.rotation.y = i * .08;
            }
            const resetStart = room.children.length;
            box(room, 3.1, 1.6, -2.1, .75, 1.05, .45, dark);
            const resetButton = cyl(room, 3.1, 1.75, -1.8, .23, .18, state.repaired.info ? mint : red);
            resetButton.rotation.x = Math.PI / 2;
            label('ОТЛАДКА', 3.1, 2.42, -1.78, 1.35);
            bindRecent('reset', resetStart);
            bind('clock', label('ПРИЁМ 24/7', -2.7, 2.9, -3.45, 1.5));
        }
        else if (state.room === 'server') {
            for (const x of [-1.3, .15]) {
                box(room, x, 1.3, -2, 1.2, 2.6, 1.1, dark);
                for (let y = .3; y < 2.5; y += .37) {
                    box(room, x, y, -1.42, 1, .22, .05, teal);
                    for (let j = 0; j < 3; j++)
                        coolingSignal(box(room, x - .35 + j * .16, y, -1.37, .065, .06, .03, state.repaired.server ? mint : red));
                }
            }
            robot(-2.5, .2, 'engineer');
            const coffee = group(room, -3.65, 0, .5);
            cyl(coffee, 0, .42, 0, .06, .8, copper);
            box(coffee, 0, .84, 0, .58, .08, .56, dark);
            cyl(coffee, 0, 1.025, 0, .14, .27, cream);
            ring(coffee, .17, 1.03, .01, .1, .035, copper);
            bind('coffee', coffee);
            const fanStart = room.children.length;
            box(room, 2.5, 1.8, -3.48, 2.6, 2.75, .35, dark);
            ring(room, 2.5, 1.8, -3.21, .95, .1, copper);
            fan = group(room, 2.5, 1.8, -3.2);
            for (let i = 0; i < 5; i++) {
                const pivot = group(fan);
                pivot.rotation.z = i * Math.PI * 2 / 5;
                const blade = box(pivot, 0, .43, 0, .36, .78, .1, cream);
                blade.rotation.z = -.3;
            }
            ball(room, 2.5, 1.8, -3.07, .19, copper);
            for (const x of [1.7, 2.1, 2.5, 2.9, 3.3])
                box(room, x, 1.8, -2.84, .025, 1.8, .03, dark);
            label('ОХЛАЖДЕНИЕ', 2.5, 3.25, -2.81, 1.9);
            box(room, 2.5, .55, -3.15, 1.1, .55, .25, teal);
            for (let i = 0; i < 3; i++)
                coolingSignal(ball(room, 2.2 + i * .3, .58, -2.99, .06, state.repaired.server ? mint : red));
            bindRecent('fan', fanStart);
            for (let i = 0; i < 4; i++) {
                const s = ball(room, -.8 + i * .22, 2.7 + i * .2, -2, .2 + i * .025, mat(0x89918c));
                s.visible = !state.repaired.server;
                smoke.push(s);
            }
            temperatureLabel = label(props.debugTemperature !== undefined ? props.debugTemperature + ' °C' : state.repaired.server ? '36 °C' : '95 °C', -.6, 2.34, -1.32, 1.35);
            const extinguisherStart = room.children.length;
            cyl(room, -3.82, .65, -2.1, .2, 1.05, red);
            box(room, -3.82, 1.23, -2.1, .3, .1, .22, dark);
            label('ПРИ ДЕДЛАЙНЕ', -3.8, 1.6, -1.9, 1.1);
            bindRecent('extinguisher', extinguisherStart);
            {
                const fire = mat(0xff9b38, 0xeb511c);
                for (let i = 0; i < 5; i++) {
                    const f = ball(room, -1.55 + i * .4, 2.8, -1.9, .18, fire);
                    f.scale.y = 1.8;
                    f.visible = !state.repaired.server;
                    flames.push(f);
                }
                overheatLight = new THREE.PointLight(0xff7b30, state.repaired.server ? 0 : 2.4, 5);
                overheatLight.position.set(-.5, 2.5, -1.5);
                room.add(overheatLight);
            }
            const mistMaterial = mat(0xbbe3dd);
            mistMaterial.transparent = true;
            mistMaterial.opacity = .6;
            mistMaterial.depthWrite = false;
            for (let i = 0; i < 6; i++) {
                const p = ball(room, -2.4 + i * .35, 1.6 + i * .16, -1.7, .22, mistMaterial);
                p.visible = false;
                steam.push(p);
            }
        }
        else if (state.room === 'gate') {
            robot(-2, .1, 'guard');
            const gateStart = room.children.length;
            box(room, 1.7, 1.5, -2.4, 2.75, 3, .4, copper);
            box(room, 1.7, 1.5, -2.1, 2.4, 2.9, .25, black);
            hingeDoor('gate', box(room, 1.7, 1.4, -1.87, 2.2, 2.6, .18, teal), 2.2);
            if (!state.repaired.gate) {
                for (let y = .25; y < 2.6; y += .28)
                    box(room, 1.7, y, -1.75, 2.15, .055, .04, copper);
                ring(room, 1.7, 1.55, -1.6, .23, .07, yellow);
                box(room, 1.7, 1.28, -1.56, .55, .42, .14, yellow);
            }
            label(state.repaired.gate ? 'АРХИВ ОТКРЫТ' : 'АРХИВ', 1.7, 3.25, -2, 2.3);
            bindRecent('gate', gateStart);
            drawer(2.5, 1);
            box(room, 2.12, 1.18, .82, .34, .025, .38, paper);
            const snail = group(room, 2.8, 1.21, 1.17);
            const foot = ball(snail, 0, .07, 0, .25, olive);
            foot.scale.set(1.5, .38, .6);
            ring(snail, 0, .3, 0, .2, .085, copper);
            ring(snail, 0, .3, .06, .08, .035, yellow);
            for (const i of [-1, 1]) {
                const stalk = cyl(snail, -.3, .25, i * .1, .025, .3, olive);
                stalk.rotation.z = -.25;
                ball(snail, -.34, .42, i * .1, .055, mint);
            }
            bind('snail', snail);
        }
        else if (state.room === 'archive') {
            const cabinetStart = room.children.length;
            for (const x of [-2.4, -.85, .7]) {
                drawer(x, -1.7);
                box(room, x, 1.8, -1.7, 1.35, 1.3, .9, dark);
                for (const y of [1.4, 1.8, 2.2]) {
                    box(room, x, y, -1.2, 1.23, .3, .07, teal);
                    box(room, x, y, -1.12, .3, .07, .02, paper);
                }
            }
            bind('cabinet', ...room.children.slice(cabinetStart));
            cyl(room, -2.4, .4, 1, .42, .8, copper);
            for (let i = 0; i < 3; i++)
                box(room, -2.55 + i * .14, .84 + i * .02, 1, .28, .04, .37, paper);
            box(room, 2.5, .22, .8, 1.6, .4, 1.4, dark);
            frog = group(room, 2.5, .45, .8);
            const belly = ball(frog, 0, .47, 0, .64, olive);
            belly.scale.set(1, .8, .85);
            throat = ball(frog, 0, .48, .4, .35, cream);
            throat.scale.set(1, .7, .5);
            for (const i of [-1, 1]) {
                const thigh = ball(frog, i * .54, .12, 0, .3, olive);
                thigh.scale.set(1, .65, 1.2);
                for (let j = 0; j < 3; j++)
                    ball(frog, i * .52 + (j - 1) * .11, .02, .45, .095, olive);
                ball(frog, i * .34, 1, .15, .3, olive);
                ball(frog, i * .34, 1.03, .35, .24, paper);
                const pupil = ball(frog, i * .32, 1.05, .54, .105, black);
                pupil.scale.z = .4;
                blinkers.push(pupil);
                ball(frog, i * .29, 1.12, .575, .04, white);
            }
            const smile = mesh(new THREE.TorusGeometry(.33, .035, 8, 24, Math.PI), black, frog, 0, .68, .54);
            smile.rotation.z = Math.PI;
            box(frog, 0, 1.4, .06, .72, .05, .55, paper).rotation.z = -.1;
            label('КВАКСИЛЬДА / QA', 2.5, .28, 1.53, 1.55);
            label('БАГИ НА ОБЕД', 2.65, 2.5, -3.32, 1.9);
            const bookStart = room.children.length;
            for (let i = 0; i < 3; i++)
                box(room, .5, 2.5 + i * .06, -1.65, .75, .05, .65, i % 2 ? paper : copper);
            label('README', .5, 2.84, -1.3, 1.15);
            bindRecent('book', bookStart);
            for (const i of [-1, 1]) {
                const brow = box(frog!, i * .34, 1.34, .33, .38, .08, .16, olive);
                brow.rotation.z = -i * .22;
                const arm = ball(frog!, i * .48, .49, .4, .16, olive);
                arm.scale.set(.6, 1.45, .8);
                ring(frog!, i * .34, 1.03, .56, .27, .025, copper);
            }
            frogTongue = box(frog!, 0, .55, .75, .16, .035, .5, red);
            frogTongue.visible = false;
            bind('frog', frog!);
        }
        else {
            // Pneumatic mail counter, conveyor and uniformed postmaster form one workstation.
            robot(-2.5, -.7, 'post');
            box(room, 0, .6, -1, 2.25, 1.15, 1.25, blue);
            box(room, 0, 1.2, -.75, 2.55, .13, 1.8, copper);
            const terminalStart = room.children.length;
            const monitor = group(room, 0, 1.38, -1.1);
            monitor.rotation.x = -.18;
            box(monitor, 0, .25, 0, 1.35, .85, .38, teal);
            box(monitor, 0, .25, .22, 1.12, .59, .025, black);
            label('ACK ?', 0, .26, .245, 1.05, monitor);
            box(room, 0, 1.28, -.08, .9, .04, .35, dark);
            for (let i = 0; i < 5; i++)
                box(room, -.3 + i * .15, 1.31, -.07, .08, .025, .11, cream);
            bindRecent('terminal', terminalStart);
            box(room, 2.1, 1.23, -1, 1.75, .18, .85, dark);
            for (let i = 0; i < 6; i++) {
                const roller = cyl(room, 1.4 + i * .28, 1.34, -1, .065, .72, copper);
                roller.rotation.x = Math.PI / 2;
                mailRollers.push(roller);
                box(roller, 0, 0, .06, .025, .65, .012, dark);
            }
            cyl(room, 3.5, 1.8, -1, .3, 3.1, copper);
            ring(room, 3.5, 3.3, -1, .33, .07, cream).rotation.x = Math.PI / 2;
            box(room, 3.35, 1.58, -1, .55, .65, .8, blue);
            const intake = cyl(room, 3.04, 1.56, -1, .3, .08, black);
            intake.rotation.z = Math.PI / 2;
            const rim = ring(room, 3, 1.56, -1, .3, .035, copper);
            rim.rotation.y = Math.PI / 2;
            for (let i = 0; i < 5; i++)
                pressureLights.push(ball(room, 3.48, 1.6 + i * .32, -.69, .06, mint));
            box(room, 2.95, .5, -1.35, .7, .85, 1.2, blue);
            label('ПНЕВМОПОЧТА', 1.4, 3.15, -3.4, 3);
            bell = group(room, 1.04, 1.39, -.12);
            const dome = ball(bell, 0, 0, 0, .18, copper);
            dome.scale.y = .55;
            cyl(bell, 0, -.07, 0, .23, .055, dark);
            cyl(bell, 0, .12, 0, .04, .12, copper);
            bind('bell', bell);
            bind('mailbox', label('СПАМ', -1.4, 2.3, -3.2, .8));
            for (const x of [-1.4, 0, 1.4]) {
                const start = room.children.length;
                box(room, x, 2.35, -3.45, 1.1, .72, .36, blue);
                box(room, x, 2.48, -3.24, .75, .09, .025, black);
                box(room, x, 2.2, -3.24, .3, .1, .025, paper);
                if (x === -1.4)
                    bind('mailbox', ...(objectRoots.get('mailbox') ?? []), ...room.children.slice(start));
            }
        }
        const bugLights: THREE.Mesh[] = [], loopPapers: THREE.Mesh[] = [], archiveFiles: THREE.Object3D[] = [];
        {
            const repaired = corridor ? false : state.room === 'info' ? state.repaired.info : state.room === 'server' ? state.repaired.server : state.room === 'gate' ? state.repaired.gate : state.room === 'archive' ? state.repaired.archive : state.repaired.dispatch;
            // Wall-mounted diagnostic equipment adds detail without obstructing the courier.
            if (!corridor) {
                box(room, .15, 2.55, -3.52, 2.35, .68, .16, dark);
                box(room, .15, 2.55, -3.42, 2.16, .51, .02, black);
                const diagnostic = label(state.room === 'info' ? (repaired ? 'ОТВЕТ СОХРАНЁН' : 'ЦИКЛ: СНОВА ПРИВЕТ') : state.room === 'server' ? (repaired ? 'ОХЛАЖДЕНИЕ: ON' : 'ДАТЧИК: ПЕРЕГРЕВ') : state.room === 'gate' ? (repaired ? 'ДОПУСК ПРОВЕРЕН' : 'ПРОВЕРКА: ОШИБКА') : state.room === 'archive' ? (repaired ? 'ФАЙЛЫ: 3 / 3' : 'ФАЙЛЫ: 2 / 3') : (repaired ? 'ОТВЕТ ПОЛУЧЕН' : 'ОЖИДАНИЕ ОТВЕТА'), .15, 2.55, -3.38, 2.12);
                if (state.room === 'server')
                    coolingStatusLabel = diagnostic;
            }
            for (let i = 0; i < 4; i++) {
                const light = box(room, -4.18, 1.1 + i * .3, -2.9, .08, .12, .22, repaired ? mint : yellow);
                bugLights.push(light);
            }
            for (let i = 0; i < 5; i++) {
                box(room, -4.14, .9 + i * .35, 2, .1, .07, .55, copper);
                box(room, -4.08, .9 + i * .35, 2, .04, .035, .35, repaired ? mint : red);
            }
            if (corridor) {
                label('БАГ-ПАТРУЛЬ / 404', -.5, 3.1, -3.45, 2.55);
                for (let i = 0; i < 5; i++) {
                    const fixed = [state.repaired.info, state.repaired.server, state.repaired.gate, state.repaired.archive, state.repaired.dispatch][i];
                    box(room, -1.35 + i * .45, 2.72, -3.43, .33, .16, .07, fixed ? mint : red);
                }
                for (const z of [-2.7, -1.4, 0, 1.3, 2.6])
                    box(room, -4.18, .25, z, .13, .06, .4, mint);
            }
            if (state.room === 'info') {
                for (let i = 0; i < 4; i++) {
                    const sheet = box(room, 1.1, 1.2 + i * .06, -.55, .8, .025, .6, paper);
                    sheet.rotation.y = i * .1;
                    loopPapers.push(sheet);
                }
                label(state.repaired.info ? '1 ОТВЕТ' : '3 ОТВЕТА', 1, 1.65, -.4, 1.4);
            }
            if (state.room === 'gate') {
                for (let i = 0; i < 3; i++) {
                    const card = group(room, 2.04 + i * .11, 1.21, .8);
                    box(card, 0, 0, 0, .09, .025, .18, i === 0 ? mint : paper);
                    box(card, 0, .02, 0, .06, .015, .05, i === 2 ? red : teal);
                }
                const rule = group(room, -4.06, 2.15, -1.1);
                rule.rotation.y = Math.PI / 2;
                label('ПРОПУСК + НЕТ ЗАПРЕТА', 0, 0, 0, 2.2, rule);
            }
            if (state.room === 'archive') {
                const count = props.previewFiles ?? (state.repaired.archive ? 3 : 2);
                for (let i = 0; i < 3; i++) {
                    const file = group(room, -2.35 + i * .48, 2.735, -1.65);
                    box(file, 0, 0, 0, .32, .51, .22, paper);
                    box(file, 0, .07, .13, .22, .07, .025, i === 2 ? yellow : teal);
                    file.visible = i < count;
                    archiveFiles.push(file);
                }
                label('0      1      2', -1.85, 3.32, -1.48, 1.6);
            }
            if (state.room === 'dispatch') {
                for (let i = 0; i < 3; i++) {
                    box(room, -3.5, 2.05 + i * .32, -3.3, .68, .2, .18, blue);
                    label(['ОТПРАВКА', 'ОТВЕТ', 'ДОСТАВКА'][i], -2.5, 2.05 + i * .32, -3.32, 1.15);
                }
            }
        }
        const interactive: {
            id: string;
            roots: THREE.Object3D[];
            meshes: THREE.Mesh[];
            materials: {
                material: THREE.MeshStandardMaterial;
                color: THREE.Color;
                emissive: THREE.Color;
                intensity: number;
                y: number;
                h: number;
            }[];
            bounds: THREE.Box3;
            outline: THREE.LineBasicMaterial;
        }[] = [];
        if (!cover) {
            room.updateMatrixWorld(true);
            for (const t of visible) {
                const roots = objectRoots.get(t.id);
                if (!roots?.length)
                    continue;
                const outline = new THREE.LineBasicMaterial({ color: 0x7bd5bf, transparent: true, opacity: .6, depthWrite: false });
                materials.push(outline);
                const meshes: THREE.Mesh[] = [], glow: typeof interactive[number]['materials'] = [];
                const bounds = new THREE.Box3();
                for (const root of roots) {
                    bounds.expandByObject(root);
                    root.traverse(o => {
                        if (!(o instanceof THREE.Mesh))
                            return;
                        meshes.push(o);
                        if (['BoxGeometry', 'CylinderGeometry'].includes(o.geometry.type)) {
                            const edgeGeometry = new THREE.EdgesGeometry(o.geometry, 35);
                            geometries.push(edgeGeometry);
                            const edges = new THREE.LineSegments(edgeGeometry, outline);
                            edges.renderOrder = 1;
                            o.add(edges);
                        }
                        const surfaceBounds = new THREE.Box3().setFromObject(o), surfaceCenter = surfaceBounds.getCenter(new THREE.Vector3());
                        const clone = (m: THREE.Material) => {
                            if (!(m instanceof THREE.MeshStandardMaterial))
                                return m;
                            const own = m.clone();
                            materials.push(own);
                            glow.push({ material: own, color: own.color.clone(), emissive: own.emissive.clone(), intensity: own.emissiveIntensity, y: surfaceCenter.y, h: Math.max(.15, surfaceBounds.max.y - surfaceBounds.min.y) });
                            return own;
                        };
                        o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
                    });
                }
                interactive.push({ id: t.id, roots, meshes, materials: glow, bounds, outline });
            }
        }
        const pickMeshes = interactive.flatMap(item => item.meshes), meshTargets = new Map<THREE.Object3D, string>();
        interactive.forEach(item => item.meshes.forEach(m => meshTargets.set(m, item.id)));
        let hovered: string | null = null, focused: string | null = null;
        const setHover = (id: string | null) => {
            if (hovered !== id)
                forceFrame = true;
            hovered = id;
            renderer.domElement.style.cursor = id ? 'pointer' : 'default';
            if (objectTip.current) {
                objectTip.current.textContent = id ? (isEasterEgg(id) ? '✦ Пасхалка · ' : '') + (visible.find(t => t.id === id)?.label ?? '') : '';
                objectTip.current.hidden = !id || latest.current.showLabels === false;
            }
        };
        const guideShape = new THREE.Shape();
        guideShape.moveTo(-.13, -.09).lineTo(0, .04).lineTo(.13, -.09).lineTo(.13, .02).lineTo(0, .15).lineTo(-.13, .02).closePath();
        const guideGeometry = new THREE.ShapeGeometry(guideShape);
        guideGeometry.rotateX(Math.PI / 2);
        geometries.push(guideGeometry);
        const guideMaterial = new THREE.MeshBasicMaterial({ color: 0x8ff9d7, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide });
        materials.push(guideMaterial);
        const guideArrows = new THREE.InstancedMesh(guideGeometry, guideMaterial, 64);
        guideArrows.count = 0;
        guideArrows.frustumCulled = false;
        room.add(guideArrows);
        const endGeometry = new THREE.RingGeometry(.23, .28, 32);
        endGeometry.rotateX(-Math.PI / 2);
        geometries.push(endGeometry);
        const endMaterial = new THREE.MeshBasicMaterial({ color: 0xffd28b, transparent: true, opacity: .85, depthWrite: false });
        materials.push(endMaterial);
        const guideEnd = new THREE.Mesh(endGeometry, endMaterial);
        guideEnd.visible = false;
        room.add(guideEnd);
        let guideId: string | null | undefined, guideFrom = { x: Infinity, z: Infinity }, guideAt = -Infinity;
        const guideMatrix = new THREE.Matrix4(), guideRotation = new THREE.Quaternion(), guideAxis = new THREE.Vector3(0, 1, 0), guideScale = new THREE.Vector3(1, 1, 1);
        let guidance: ReturnType<typeof routeGuidance> = { markers: [], end: null };
        const previousRoom = last.current?.room;
        let arrival = last.current && !last.current.cover && previousRoom !== state.room && !cover ? 0 : 1;
        const entrance = corridor ? targets.corridor.find(t => t.id === previousRoom) : targets[state.room].find(t => t.id === (state.room === 'gate' && previousRoom === 'archive' ? 'gate' : 'exit'));
        const entryTo = entrance?.approach ?? { x: corridor ? -3 : 0, z: 2.9 }, entryFrom = entrance ?? entryTo;
        const courier = robot(corridor ? -3 : 0, 2.9, 'courier');
        if (arrival === 0) {
            courier.group.position.set(entryTo.x, 0, entryTo.z);
            setTransition('arriving');
            latest.current.onTransition?.(true);
        }
        if (last.current?.room === state.room)
            courier.group.position.set(last.current.x, 0, last.current.z);
        courier.group.rotation.y = arrival === 0 ? Math.atan2(entryTo.x - entryFrom.x, entryTo.z - entryFrom.z) : last.current?.room === state.room ? last.current.heading : .25;
        if (arrival === 0 && entrance)
            openDoor(entrance.id, 1);
        const tapMaterial = new THREE.MeshBasicMaterial({ color: 0xffd28b, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide });
        materials.push(tapMaterial);
        const tapGeometry = new THREE.RingGeometry(.29, .34, 40);
        tapGeometry.rotateX(-Math.PI / 2);
        geometries.push(tapGeometry);
        const tapRing = new THREE.Mesh(tapGeometry, tapMaterial);
        tapRing.visible = false;
        room.add(tapRing);
        // A short confirmation glow belongs to the repaired prop, not another UI panel.
        const repairHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xa9f5d2, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
        materials.push(repairHaloMaterial);
        const repairHaloGeometry = new THREE.RingGeometry(.94, 1, 64);
        geometries.push(repairHaloGeometry);
        const repairHalo = new THREE.Mesh(repairHaloGeometry, repairHaloMaterial);
        repairHalo.visible = false;
        repairHalo.renderOrder = 4;
        scene.add(repairHalo);
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128;
        glowCanvas.height = 128;
        const glowContext = glowCanvas.getContext('2d')!, glowGradient = glowContext.createRadialGradient(64, 64, 10, 64, 64, 64);
        glowGradient.addColorStop(0, '#adf7d65c');
        glowGradient.addColorStop(.45, '#adf7d62b');
        glowGradient.addColorStop(1, '#adf7d600');
        glowContext.fillStyle = glowGradient;
        glowContext.fillRect(0, 0, 128, 128);
        const glowTexture = new THREE.CanvasTexture(glowCanvas);
        textures.push(glowTexture);
        const repairGlowMaterial = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
        materials.push(repairGlowMaterial);
        const repairGlow = new THREE.Sprite(repairGlowMaterial);
        repairGlow.visible = false;
        repairGlow.renderOrder = 3;
        scene.add(repairGlow);
        const restoredFile = archiveFiles[2], restoredFileMaterials: {
            material: THREE.MeshStandardMaterial;
            emissive: THREE.Color;
            intensity: number;
        }[] = [];
        restoredFile?.traverse(o => {
            if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial))
                return;
            const own = o.material.clone();
            materials.push(own);
            restoredFileMaterials.push({ material: own, emissive: own.emissive.clone(), intensity: own.emissiveIntensity });
            o.material = own;
        });
        let repairId: string | null = null, repairStarted = -Infinity, repairRadius = .5, cheerArm = 0, cheerBob = 0, cheerHead = 0;
        let tapped: string | null = null, tappedAt = -Infinity;
        let queuedMove: string | null = null;
        let facing = courier.group.rotation.y, phase = 0, walkBlend = 0, stepIndex = 0, route: {
            x: number;
            z: number;
        }[] = [], pending: string | null = null;
        const obstacles = roomObstacles[state.room];
        let doorway: {
            id: string;
            room: Room;
            age: number;
            from: THREE.Vector3;
            to: THREE.Vector3;
        } | null = null, awaitingRoom = false;
        function travelOrInspect(id: string) {
            const next = id === 'exit' ? (state.room === 'archive' ? 'gate' : 'corridor') : corridor && ['info', 'server', 'gate', 'dispatch'].includes(id) ? id as Room : state.room === 'gate' && id === 'gate' && latest.current.state.repaired.gate ? 'archive' : null;
            if (!next) {
                latest.current.onInspect?.(id);
                return;
            }
            if (latest.current.canEnter && !latest.current.canEnter(next)) {
                latest.current.onInspect?.('locked');
                return;
            }
            const t = targets[state.room].find(t => t.id === id)!;
            doorway = { id, room: next, age: 0, from: courier.group.position.clone(), to: new THREE.Vector3(t.x, 0, t.z) };
            setTransition('leaving');
            latest.current.onTransition?.(true);
        }
        const move = (id: string, scripted = false) => {
            if (doorway || awaitingRoom)
                return;
            if (arrival < 1) {
                queuedMove = id;
                return;
            }
            if (latest.current.paused && !scripted)
                return;
            const t = targets[state.room].find(t => t.id === id);
            if (!t)
                return;
            forceFrame = true;
            tapped = id;
            tappedAt = performance.now();
            tapRing.position.set(t.approach?.x ?? t.x, .085, t.approach?.z ?? t.z);
            latest.current.onWalk?.();
            route = walkingPath(courier.group.position, t.approach ?? { x: t.x, z: t.z + 1.2 }, width, obstacles);
            pending = id;
        };
        controls.current = { move, focus: id => { focused = id; setHover(id); }, stop: () => {
                if (!doorway && arrival === 1) {
                    route = [];
                    pending = null;
                    queuedMove = null;
                    forceFrame = true;
                }
            } };
        const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
        let down: {
            x: number;
            y: number;
            id: number;
        } | null = null;
        const pointerDown = (e: PointerEvent) => {
            if (e.button === 0)
                down = { x: e.clientX, y: e.clientY, id: e.pointerId };
        };
        const pick = (x: number, y: number, touch = false) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
            raycaster.setFromCamera(mouse, camera);
            const direct = raycaster.intersectObjects(pickMeshes, false)[0];
            if (direct)
                return meshTargets.get(direct.object) ?? null;
            // Small props get a 44 px touch area without adding visible buttons.
            if (touch) {
                let closest: string | null = null, distance = Infinity;
                for (const item of interactive) {
                    const b = screenBounds(item.bounds), dx = Math.max(0, Math.abs(x - b.x) - Math.max(22, b.w / 2)), dy = Math.max(0, Math.abs(y - b.y) - Math.max(22, b.h / 2));
                    if (dx || dy)
                        continue;
                    const d = Math.hypot(x - b.x, y - b.y);
                    if (d < distance) {
                        distance = d;
                        closest = item.id;
                    }
                }
                return closest;
            }
            return null;
        };
        const pointerMove = (e: PointerEvent) => {
            if (e.pointerType === 'touch' || cover || latest.current.paused || doorway || arrival < 1) {
                setHover(null);
                return;
            }
            setHover(pick(e.clientX, e.clientY));
        };
        const pointerLeave = () => { setHover(null); };
        const pointerUp = (e: PointerEvent) => {
            const start = down;
            down = null;
            if (!start || start.id !== e.pointerId || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10 || cover || latest.current.paused || doorway || awaitingRoom || arrival < 1)
                return;
            {
                const id = pick(e.clientX, e.clientY, e.pointerType === 'touch');
                if (id) {
                    setHover(null);
                    move(id);
                    return;
                }
            }
            const r = renderer.domElement.getBoundingClientRect();
            mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
            raycaster.setFromCamera(mouse, camera);
            if (raycaster.ray.intersectPlane(floor, hit)) {
                latest.current.onWalk?.();
                route = walkingPath(courier.group.position, hit, width, obstacles);
                pending = null;
            }
        };
        const cancel = () => { down = null; };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointerup', pointerUp);
        renderer.domElement.addEventListener('pointercancel', cancel);
        renderer.domElement.addEventListener('pointermove', pointerMove);
        renderer.domElement.addEventListener('pointerleave', pointerLeave);
        const key = (e: KeyboardEvent) => {
            const d: Record<string, number[]> = { ArrowLeft: [-.7, 0], ArrowRight: [.7, 0], ArrowUp: [0, -.6], ArrowDown: [0, .6] };
            if (d[e.key] && e.target === host.current && !latest.current.paused) {
                e.preventDefault();
                latest.current.onWalk?.();
                const goal = route.at(-1) ?? courier.group.position;
                route = walkingPath(courier.group.position, { x: goal.x + d[e.key][0], z: goal.z + d[e.key][1] }, width, obstacles);
                pending = null;
            }
        };
        host.current?.addEventListener('keydown', key);
        const resize = () => {
            const w = el.clientWidth, h = el.clientHeight;
            if (!w || !h)
                return;
            forceFrame = true;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2, Math.sqrt(3000000 / (w * h))));
            renderer.setSize(w, h);
            const aspect = w / h;
            camera.updateMatrixWorld();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const x of [-width / 2 - .25, width / 2 + .25])
                for (const y of [-1.1, 3.7])
                    for (const z of [-3.9, 4.2]) {
                        const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
                        minX = Math.min(minX, v.x);
                        maxX = Math.max(maxX, v.x);
                        minY = Math.min(minY, v.y);
                        maxY = Math.max(maxY, v.y);
                    }
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, halfW = (maxX - minX) / 2 + .3, halfH = (maxY - minY) / 2 + .65;
            const hw = Math.max(halfW, halfH * aspect), hh = hw / aspect;
            camera.left = cx - hw;
            camera.right = cx + hw;
            camera.top = cy + hh;
            camera.bottom = cy - hh;
            camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(el);
        resize();
        const packet = group(room, 1.05, 1.56, -1);
        box(packet, 0, 0, 0, .65, .42, .4, paper);
        box(packet, 0, 0, .22, .12, .43, .025, copper);
        packet.visible = false;
        const scanner = box(room, 1.12, 1.58, -1, .025, .6, .65, mint);
        scanner.visible = false;
        const motes = Array.from({ length: 12 }, (_, i) => { const m = ball(room, Math.sin(i * 17) * 3, 1 + (i % 4) * .6, Math.cos(i * 13) * 2, .018, paper); return m; });
        let reactionSerial = 0, reactionAge = 9, reactionId = '';
        let sendStart: number | null = null, sent = false, frame = 0, old = performance.now(), renderedProps: Props | undefined, renderCount = 0;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const wake = () => { old = performance.now(); forceFrame = true; };
        document.addEventListener('visibilitychange', wake);
        media.addEventListener('change', wake);
        const screenBounds = (bounds: THREE.Box3) => {
            const rect = renderer.domElement.getBoundingClientRect();
            let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
            for (const x of [bounds.min.x, bounds.max.x])
                for (const y of [bounds.min.y, bounds.max.y])
                    for (const z of [bounds.min.z, bounds.max.z]) {
                        const p = new THREE.Vector3(x, y, z).project(camera);
                        left = Math.min(left, rect.left + (p.x * .5 + .5) * rect.width);
                        right = Math.max(right, rect.left + (p.x * .5 + .5) * rect.width);
                        top = Math.min(top, rect.top + (-p.y * .5 + .5) * rect.height);
                        bottom = Math.max(bottom, rect.top + (-p.y * .5 + .5) * rect.height);
                    }
            return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
        };
        function tick(now: number) {
            frame = requestAnimationFrame(tick);
            if (document.hidden) {
                old = now;
                return;
            }
            const reduced = media.matches || latest.current.reduceMotion;
            const busy = route.length > 0 || !!doorway || arrival < 1 || latest.current.sending || reactionAge < 2 || now - repairStarted < 2400 || now - tappedAt < 750;
            const renderRate = busy ? 60 : reduced ? 15 : latest.current.paused ? 24 : 60;
            if (!forceFrame && renderedProps === latest.current && now - old < 1000 / renderRate - 1)
                return;
            const dt = Math.min((now - old) / 1000, .1);
            old = now;
            forceFrame = false;
            renderedProps = latest.current;
            // Remove the previous additive gesture before walking updates its base pose.
            courier.arms.forEach(arm => arm.rotation.x -= cheerArm);
            courier.body.position.y -= cheerBob;
            courier.head.rotation.z -= cheerHead;
            cheerArm = cheerBob = cheerHead = 0;
            temperatureLabel?.userData.setText(latest.current.debugTemperature !== undefined ? latest.current.debugTemperature + ' °C' : latest.current.state.repaired.server ? '36 °C' : '95 °C');
            if (latest.current.paused && !doorway && arrival === 1) {
                route = [];
                pending = null;
            }
            if (arrival < 1 && !latest.current.paused) {
                arrival = Math.min(1, arrival + dt / (reduced ? .3 : 1.25));
                const walk = Math.min(1, arrival / .7);
                courier.group.position.set(entryFrom.x + (entryTo.x - entryFrom.x) * walk, 0, entryFrom.z + (entryTo.z - entryFrom.z) * walk);
                courier.legs.forEach((leg, i) => { leg.position.y = reduced || walk === 1 ? 0 : Math.max(0, Math.sin(walk * 16 + i * Math.PI)) * .12; });
                if (entrance)
                    openDoor(entrance.id, 1 - smooth((arrival - .7) / .3));
                if (arrival === 1) {
                    facing = courier.group.rotation.y;
                    setTransition(null);
                    latest.current.onTransition?.(false);
                    if (queuedMove) {
                        const id = queuedMove;
                        queuedMove = null;
                        move(id, true);
                    }
                }
            }
            else if (doorway && !latest.current.paused) {
                doorway.age += dt;
                const progress = Math.min(1, doorway.age / (reduced ? .3 : 1.5)), walk = Math.max(0, (progress - .35) / .65);
                openDoor(doorway.id, smooth(progress / .35));
                courier.group.position.lerpVectors(doorway.from, doorway.to, walk);
                courier.group.rotation.y = Math.atan2(doorway.to.x - doorway.from.x, doorway.to.z - doorway.from.z);
                courier.legs.forEach((leg, i) => { leg.position.y = reduced || walk === 0 ? 0 : Math.max(0, Math.sin(walk * 20 + i * Math.PI)) * .1; });
                if (progress >= 1 && !awaitingRoom) {
                    awaitingRoom = true;
                    latest.current.onTravel?.(doorway.room);
                }
            }
            else if (arrival === 1 && !doorway && !latest.current.paused && !awaitingRoom) {
                const step = advanceWalk(courier.group.position, route, dt, reduced);
                route = step.route;
                courier.group.position.set(step.position.x, 0, step.position.z);
                if (step.heading !== undefined)
                    facing = step.heading;
                phase += step.travelled * 7;
                walkBlend += (Number(step.travelled > 0) - walkBlend) * Math.min(1, dt * 14);
                if (reduced)
                    walkBlend = 0;
                courier.legs.forEach((leg, i) => { const stride = Math.sin(phase + i * Math.PI) * walkBlend; leg.position.z = stride * .18; leg.position.y = Math.max(0, stride) * .15; });
                courier.arms.forEach((arm, i) => { arm.rotation.x = -Math.sin(phase + i * Math.PI) * .48 * walkBlend; });
                courier.body.position.y = Math.abs(Math.sin(phase)) * .045 * walkBlend;
                courier.body.rotation.z = Math.sin(phase) * .035 * walkBlend;
                courier.head.rotation.y = Math.sin(phase) * .025 * walkBlend;
                const beat = Math.floor(phase / Math.PI);
                if (beat > stepIndex && walkBlend > .2) {
                    latest.current.onStep?.();
                    stepIndex = beat;
                }
                if (!route.length && pending) {
                    const id = pending;
                    pending = null;
                    const t = targets[state.room].find(t => t.id === id)!;
                    facing = Math.atan2(t.x - step.position.x, t.z - step.position.z);
                    travelOrInspect(id);
                }
                courier.group.rotation.y = reduced ? facing : turnTowards(courier.group.rotation.y, facing, dt);
            }
            last.current = { room: state.room, x: courier.group.position.x, z: courier.group.position.z, heading: courier.group.rotation.y, cover };
            const nextRepair = latest.current.repairTarget ?? null;
            if (nextRepair !== repairId) {
                repairId = nextRepair;
                repairStarted = nextRepair ? now : -Infinity;
                if (nextRepair) {
                    room.updateMatrixWorld(true);
                    const bounds = state.room === 'archive' && nextRepair === 'cabinet' && restoredFile ? new THREE.Box3().setFromObject(restoredFile) : interactive.find(item => item.id === nextRepair)?.bounds;
                    if (bounds) {
                        bounds.getCenter(repairHalo.position);
                        repairGlow.position.copy(repairHalo.position);
                        repairRadius = Math.max(.42, Math.min(1.5, Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y) * .62));
                    }
                }
            }
            const repairAge = (now - repairStarted) / 1000, repairActive = !!repairId && repairAge < 2.4, repairStrength = repairActive ? (reduced ? .42 : Math.sin(Math.min(1, repairAge / 2.4) * Math.PI) * .85) : 0;
            repairHalo.visible = repairGlow.visible = repairActive;
            repairHalo.quaternion.copy(camera.quaternion);
            repairHalo.scale.setScalar(repairRadius * (reduced ? 1 : 1 + Math.min(1, repairAge / 2.4) * .3));
            repairHaloMaterial.opacity = repairStrength * .8;
            repairGlow.scale.setScalar(repairRadius * 3.2);
            repairGlowMaterial.opacity = repairStrength;
            restoredFileMaterials.forEach(m => {
                m.material.emissive.copy(m.emissive).multiplyScalar(m.intensity);
                if (repairId === 'cabinet')
                    m.material.emissive.add(new THREE.Color(.46, .96, .73).multiplyScalar(repairStrength * .65));
                m.material.emissiveIntensity = 1;
            });
            if (!reduced && repairActive && repairAge < 1.35) {
                const cheer = Math.sin(repairAge / 1.35 * Math.PI);
                cheerArm = -cheer * .72;
                cheerBob = cheer * .035;
                cheerHead = cheer * .07;
                courier.arms.forEach(arm => arm.rotation.x += cheerArm);
                courier.body.position.y += cheerBob;
                courier.head.rotation.z += cheerHead;
            }
            const guideVisible = !cover && !latest.current.paused && !doorway && arrival === 1 && !!latest.current.suggestedTarget;
            if (guideVisible && (guideId !== latest.current.suggestedTarget || now - guideAt > 250 && (Math.hypot(courier.group.position.x - guideFrom.x, courier.group.position.z - guideFrom.z) > .12 || guideAt === -Infinity))) {
                guideId = latest.current.suggestedTarget;
                guideFrom = { x: courier.group.position.x, z: courier.group.position.z };
                guideAt = now;
                guidance = routeGuidance(state.room, guideFrom, guideId);
                guideArrows.count = guidance.markers.length;
                guidance.markers.forEach((p, i) => { guideRotation.setFromAxisAngle(guideAxis, p.heading); guideMatrix.compose(new THREE.Vector3(p.x, .075, p.z), guideRotation, guideScale); guideArrows.setMatrixAt(i, guideMatrix); });
                guideArrows.instanceMatrix.needsUpdate = true;
                if (guidance.end)
                    guideEnd.position.set(guidance.end.x, .075, guidance.end.z);
            }
            guideArrows.visible = guideVisible;
            guideEnd.visible = guideVisible && !!guidance.end;
            guideMaterial.opacity = reduced ? .85 : .75 + Math.sin(now * .003) * .12;
            endMaterial.opacity = reduced ? .85 : .7 + Math.sin(now * .003) * .18;
            if (host.current) {
                host.current.dataset.sceneRoom = state.room;
                host.current.dataset.playerX = courier.group.position.x.toFixed(3);
                host.current.dataset.playerZ = courier.group.position.z.toFixed(3);
                host.current.dataset.walking = String(!!route.length || !!doorway || arrival < 1);
                host.current.dataset.guideTarget = latest.current.suggestedTarget ?? '';
                host.current.dataset.guideVisible = String(guideVisible);
                host.current.dataset.guideSteps = String(guideVisible ? guideArrows.count : 0);
                host.current.dataset.tapTarget = tapped ?? '';
                host.current.dataset.tapActive = String(now - tappedAt < 750);
                host.current.dataset.repairTarget = latest.current.repairTarget ?? '';
                host.current.dataset.repairAccent = String(repairActive);
                host.current.dataset.repairFocus = repairId === 'cabinet' ? 'restored-file' : repairId ?? '';
                host.current.dataset.renderCount = String(++renderCount);
                host.current.dataset.renderRate = String(renderRate);
            }
            if (!reduced) {
                if (fan && (latest.current.previewFan ?? state.repaired.server))
                    fan.rotation.z -= dt * 7;
                npcs.forEach(n => { n.body.position.y = Math.sin(now * .002 + n.phase) * .018; n.head.rotation.y = Math.sin(now * .0006 + n.phase) * .08; n.head.rotation.x = latest.current.repairTarget ? Math.sin(now * .004) * .12 : 0; n.arms.forEach((arm, i) => arm.rotation.z = latest.current.repairTarget ? (i ? 1 : -1) * (.15 + Math.sin(now * .004) * .08) : 0); });
                blinkers.forEach((eye, i) => { eye.scale.y = (now + i * 173) % 4300 < 110 ? .12 : 1; });
                if (frog) {
                    frog.position.y = .45 + (latest.current.state.repaired.archive ? Math.abs(Math.sin(now * .004)) * .09 : Math.sin(now * .002) * .025);
                    if (throat)
                        throat.scale.y = .7 + Math.sin(now * .004) * .09;
                }
                if (pigeon) {
                    pigeon.userData.head.rotation.x = Math.sin(now * .002) * .09;
                    wings.forEach((wing, i) => wing.rotation.z = (i ? 1 : -1) * Math.sin(now * (reactionId === 'pigeon' && reactionAge < 2 ? .024 : .002)) * (reactionId === 'pigeon' && reactionAge < 2 ? .9 : .07));
                }
            }
            if (latest.current.reaction && latest.current.reaction.serial !== reactionSerial) {
                reactionSerial = latest.current.reaction.serial;
                reactionId = latest.current.reaction.id;
                reactionAge = 0;
            }
            reactionAge += dt;
            if (!reduced) {
                flames.forEach((f, i) => { f.scale.y = 1.4 + Math.sin(now * .017 + i) * .55; f.rotation.z = Math.sin(now * .01 + i) * .15; });
                if (bell)
                    bell.rotation.z = reactionId === 'bell' && reactionAge < 1 ? Math.sin(reactionAge * 30) * .18 : 0;
            }
            steam.forEach(p => { p.visible = reactionId === 'extinguisher' && reactionAge < 1.5; p.scale.setScalar(.6 + reactionAge * .7); });
            if (frogTongue) {
                frogTongue.visible = !reduced && reactionId === 'frog' && reactionAge < .65;
                frogTongue.scale.z = 1 + Math.sin(reactionAge * 8) * .6;
            }
            if (!reduced && throat && reactionId === 'frog' && reactionAge < 1.5)
                throat.scale.y = .8 + Math.sin(reactionAge * 15) * .2;
            smoke.forEach((s, i) => { s.position.y = 2.7 + i * .22 + (reduced ? 0 : Math.sin(now * .001 + i) * .13); });
            {
                const tapAge = (now - tappedAt) / 750;
                tapRing.visible = tapAge < 1 && !latest.current.paused;
                tapRing.scale.setScalar(reduced ? 1 : 1 + tapAge * 1.7);
                tapMaterial.opacity = reduced ? .8 : Math.max(0, 1 - tapAge) * .9;
                const hostRect = host.current?.getBoundingClientRect(), badgePositions: {
                    x: number;
                    y: number;
                }[] = [], projected = new Map(interactive.map(item => [item.id, screenBounds(item.bounds)]));
                for (const item of interactive) {
                    const selected = item.id === (focused ?? hovered), suggested = item.id === latest.current.suggestedTarget, pressed = item.id === tapped && tapAge < 1, repaired = item.id === latest.current.repairTarget, archiveRepair = repaired && state.room === 'archive' && item.id === 'cabinet';
                    const pulse = reduced ? 1 : .86 + Math.sin(now * .0027) * .14, amount = pressed ? .55 : repaired ? (archiveRepair ? .055 : .3 * pulse + repairStrength * .2) : latest.current.paused ? .025 : selected ? .28 : suggested ? .17 * pulse : .065;
                    const tint = new THREE.Color(repaired ? 0x8ff9d7 : pressed || selected || suggested ? 0xffca6a : 0x62d7c5), light = tint.clone().multiplyScalar(amount);
                    item.outline.color.copy(tint);
                    item.outline.opacity = pressed ? 1 : repaired ? (archiveRepair ? .24 : 1) : latest.current.paused ? .16 : selected ? .95 : suggested ? .85 * pulse : .5;
                    for (const m of item.materials) {
                        m.material.emissive.copy(m.emissive).multiplyScalar(m.intensity).add(light);
                        const sweep = reduced || latest.current.paused ? 0 : Math.pow(Math.max(0, 1 - Math.abs(((now / 2200 + interactive.indexOf(item) * .17) % 1) * 4.1 - .3 - m.y) / .42), 2);
                        m.material.emissive.lerp(tint, sweep * ((selected || suggested) ? .2 : .1));
                        m.material.emissiveIntensity = 1;
                        m.material.color.copy(m.color).lerp(tint, selected ? .06 : suggested ? .025 : sweep * .025);
                    }
                    const b = projected.get(item.id)!, node = overlay.current?.querySelector<HTMLElement>('[data-target="' + item.id + '"]');
                    if (node) {
                        node.dataset.sceneX = b.x.toFixed(1);
                        node.dataset.sceneY = b.y.toFixed(1);
                        node.dataset.sceneWidth = b.w.toFixed(1);
                        node.dataset.sceneHeight = b.h.toFixed(1);
                        node.dataset.worldBounds = JSON.stringify({ min: item.bounds.min.toArray(), max: item.bounds.max.toArray() });
                        node.dataset.highlight = pressed ? 'pressed' : repaired ? 'repaired' : suggested ? 'suggested' : selected ? 'focused' : 'idle';
                        if (hostRect) {
                            node.style.left = (b.x - hostRect.left) + 'px';
                            node.style.top = (b.y - hostRect.top) + 'px';
                        }
                    }
                    const talkPin = talkOverlay.current?.querySelector<HTMLElement>('[data-talker="' + item.id + '"]');
                    if (talkPin && hostRect) {
                        talkPin.style.left = Math.max(20, Math.min(hostRect.width - 20, b.x - hostRect.left)) + 'px';
                        talkPin.style.top = Math.max(81, b.y - b.h / 2 - hostRect.top - 13) + 'px';
                        talkPin.style.opacity = '1';
                    }
                    const badge = eggOverlay.current?.querySelector<HTMLElement>('[data-easter-egg="' + item.id + '"]');
                    if (badge && hostRect) {
                        const bx = b.x - hostRect.left, by = b.y - hostRect.top;
                        let best = { x: bx, y: by, score: Infinity };
                        for (const [dx, dy] of [[-b.w / 2 - 15, 0], [b.w / 2 + 15, 0], [0, -b.h / 2 - 15], [0, b.h / 2 + 15], [-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [-b.w / 2, b.h / 2], [b.w / 2, b.h / 2]]) {
                            const x = Math.max(23, Math.min(hostRect.width - 23, bx + dx)), y = Math.max(82, Math.min(hostRect.height - 165, by + dy));
                            let score = (x - bx) ** 2 * .005 + (y - by) ** 2 * .005;
                            for (const [id, r] of projected)
                                if (id !== item.id) {
                                    const ox = r.x - hostRect.left, oy = r.y - hostRect.top;
                                    score += Math.max(0, 22 + r.w / 2 + 3 - Math.abs(x - ox)) * Math.max(0, 22 + r.h / 2 + 3 - Math.abs(y - oy)) * 10;
                                }
                            for (const q of badgePositions)
                                score += Math.max(0, 44 - Math.abs(x - q.x)) * Math.max(0, 44 - Math.abs(y - q.y)) * 20;
                            if (score < best.score)
                                best = { x, y, score };
                        }
                        badgePositions.push(best);
                        badge.style.left = best.x + 'px';
                        badge.style.top = best.y + 'px';
                        badge.style.opacity = '1';
                    }
                    if ((hovered ?? focused) === item.id && objectTip.current && hostRect) {
                        objectTip.current.hidden = latest.current.paused || latest.current.showLabels === false;
                        objectTip.current.style.left = Math.max(60, Math.min(hostRect.width - 60, b.x - hostRect.left)) + 'px';
                        objectTip.current.style.top = Math.max(70, b.y - b.h / 2 - hostRect.top - 8) + 'px';
                    }
                }
            }
            if (state.room === 'server') {
                const cooled = latest.current.state.repaired.server;
                smoke.forEach(s => s.visible = !cooled);
                flames.forEach(f => f.visible = !cooled);
                if (overheatLight)
                    overheatLight.intensity = cooled ? 0 : 2.4;
                coolingSignals.forEach(s => { const m = s.material as THREE.MeshStandardMaterial; m.color.setHex(cooled ? 0x9de8c9 : 0xed7752); m.emissive.setHex(cooled ? 0x317e6a : 0x772e1e); m.emissiveIntensity = .8; });
                coolingStatusLabel?.userData.setText(cooled ? (latest.current.previewFan === false ? 'ТЕМПЕРАТУРА: НОРМА' : 'ОХЛАЖДЕНИЕ: ON') : 'ДАТЧИК: ПЕРЕГРЕВ');
            }
            motes.forEach((m, i) => { m.visible = !reduced; m.position.y = .7 + (now * .0001 + i * .31) % 2.6; m.position.x = Math.sin(i * 17 + now * .00008) * 3; });
            if (latest.current.sending) {
                sendStart ??= now;
                const t = Math.min(1, (now - sendStart) / (reduced ? 650 : 3800)), pose = mailMotion(t);
                packet.visible = pose.visible;
                packet.position.set(pose.x, pose.y, pose.z);
                scanner.visible = !reduced && t < .18;
                scanner.position.z = -1 + Math.sin(t / .18 * Math.PI * 2) * .22;
                mailRollers.forEach(r => {
                    if (!reduced && t > .18 && t < .83)
                        r.rotateY(dt * 8);
                });
                pressureLights.forEach((light, i) => light.scale.setScalar(t > .78 && t < 1 ? 1 + Math.max(0, Math.sin(pose.pressure * 12 - i)) * .8 : 1));
                if (t >= 1 && !sent) {
                    sent = true;
                    latest.current.onSendDone?.();
                }
            }
            else {
                packet.visible = false;
                scanner.visible = false;
                sendStart = null;
                sent = false;
            }
            bugLights.forEach((light, i) => light.scale.y = reduced ? 1 : .8 + Math.sin(now * .003 + i) * .2);
            if (!reduced && state.room === 'info' && !state.repaired.info)
                loopPapers.forEach((sheet, i) => { sheet.position.y = 1.2 + i * .06 + Math.sin(now * .003 + i) * .045; sheet.rotation.y = Math.sin(now * .002 + i) * .14; });
            if (archiveFiles.length) {
                const count = latest.current.previewFiles ?? (latest.current.state.repaired.archive ? 3 : 2);
                archiveFiles.forEach((file, i) => file.visible = i < count);
            }
            renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(tick);
        const lost = (e: Event) => { e.preventDefault(); setFailed(true); setTransition(null); latest.current.onTransition?.(false); };
        renderer.domElement.addEventListener('webglcontextlost', lost);
        return () => { disposed = true; cancelAnimationFrame(frame); ro.disconnect(); document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake); host.current?.removeEventListener('keydown', key); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', cancel); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerleave', pointerLeave); renderer.domElement.removeEventListener('webglcontextlost', lost); textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove(); controls.current = undefined; };
    }, [state.room, coolingLayout, state.repaired.gate, state.repaired.info, state.repaired.archive, state.repaired.dispatch, cover]);
    useEffect(() => {
        if (!failed || !sending)
            return;
        const id = setTimeout(() => latest.current.onSendDone?.(), 700);
        return () => clearTimeout(id);
    }, [failed, sending]);
    useEffect(() => { controls.current?.stop(); }, [props.guidanceRevision]);
    function activate(t: SceneTarget) {
        if (props.paused || transition)
            return;
        if (failed) {
            const next = t.id === 'exit' ? (state.room === 'archive' ? 'gate' : 'corridor') : state.room === 'corridor' && ['info', 'server', 'gate', 'dispatch'].includes(t.id) ? t.id as Room : state.room === 'gate' && t.id === 'gate' && state.repaired.gate ? 'archive' : null;
            if (next && props.canEnter && !props.canEnter(next)) {
                props.onInspect?.('locked');
                return;
            }
            props.onWalk?.();
            if (t.id === 'exit')
                props.onTravel?.(state.room === 'archive' ? 'gate' : 'corridor');
            else if (state.room === 'gate' && t.id === 'gate' && state.repaired.gate)
                props.onTravel?.('archive');
            else if (state.room === 'corridor' && ['info', 'server', 'gate', 'dispatch'].includes(t.id))
                props.onTravel?.(t.id as Room);
            else
                props.onInspect?.(t.id);
        }
        else
            controls.current?.move(t.id);
    }
    return <div ref={host} className={`diorama ${failed ? 'fallback' : ''} ${cover ? 'cover' : ''} ${props.showLabels === false ? 'icons-only' : ''}  ${props.reduceMotion ? 'motion-off' : ''}`} tabIndex={cover ? -1 : 0} role="group" aria-label="Игровая платформа" aria-description={'Подсвеченный путь — подсказка. Нажимайте на пол или объекты, чтобы идти.'}>
  <div className="scene-canvas" ref={canvasHost}/>
  {!cover && <div ref={overlay} className={!failed ? 'scene-object-controls' : 'scene-targets'}>{!failed ? visible.map(t => <button key={t.id} data-target={t.id} aria-label={t.label} disabled={props.paused || !!transition} onFocus={() => controls.current?.focus(t.id)} onBlur={() => controls.current?.focus(null)} onClick={() => activate(t)}>{t.label}</button>) : visible.map(t => <button key={t.id} data-target={t.id} aria-label={t.label} disabled={props.paused || !!transition} className={`scene-marker ${activeTarget === t.id ? 'active' : ''} ${t.id === 'exit' ? 'exit-marker' : ''} ${['clock', 'coffee', 'snail', 'pigeon', 'router', 'extinguisher', 'book', 'bell', 'mailbox'].includes(t.id) ? 'detail-marker' : ''}`} onClick={() => activate(t)}><span className="marker-symbol">{(t.id === 'exit' || state.room === 'corridor' && ['info', 'server', 'gate', 'dispatch'].includes(t.id) || state.room === 'gate' && t.id === 'gate' && state.repaired.gate) ? <DoorOpen size={22}/> : state.room === 'gate' && t.id === 'gate' && !state.repaired.gate ? <Lock size={18}/> : ['bot', 'engineer', 'guard', 'frog', 'postman', 'pigeon', 'snail'].includes(t.id) ? <MessageCircle size={16}/> : <Search size={16}/>}</span>{attention && !props.talked?.includes(t.id) && ['bot', 'engineer', 'guard', 'frog', 'postman', 'pigeon'].includes(t.id) && <span className="talk-attention" aria-hidden="true">!</span>}<span className="marker-label">{t.label}</span></button>)}</div>}
  {!failed && !cover && attention && <div ref={talkOverlay} className="scene-talk-cues" hidden={props.paused || !!transition} aria-hidden="true">{visible.filter(t => ['bot', 'engineer', 'guard', 'frog', 'postman'].includes(t.id) && !props.talked?.includes(t.id)).map(t => <span key={t.id} data-talker={t.id} className="talk-cue">!</span>)}</div>}
  {!failed && !cover && <div ref={eggOverlay} className="scene-easter-eggs" hidden={props.paused || !!transition}>{visible.filter(t => isEasterEgg(t.id)).map(t => <button key={t.id} data-easter-egg={t.id} className={props.discovered?.includes(t.id) ? 'easter-badge found' : 'easter-badge'} aria-label={'Пасхалка: ' + t.label} title={'Пасхалка: ' + t.label} disabled={props.paused || !!transition} onClick={() => activate(t)}><span aria-hidden="true">{props.discovered?.includes(t.id) ? '✓' : '✦'}</span></button>)}</div>}
  {!failed && <div className="scene-object-tip" ref={objectTip} hidden aria-hidden="true"/>}

  {failed && <p className="fallback-note">3D недоступно. Нажимайте на названия объектов.</p>}
  {transition && <div className={`room-transition ${transition}`} aria-hidden="true"/>}

  {sending && <div className="sending-status" role="status"><SendIcon />Пневмопочта доставляет пакет…</div>}
  {children}
 </div>;
}
function SendIcon() { return <span className="sending-light" aria-hidden="true"/>; }
