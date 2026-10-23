export type Room = 'corridor' | 'info' | 'server' | 'gate' | 'archive' | 'dispatch';
export type Fragment = 'i' | 't' | 'dot' | 'mos' | 'kva';
export const fragmentText: Record<Fragment, string> = {i: 'И', t: 'Т', dot: '.', mos: 'Мос', kva: 'ква'};
export type WorldState = {room: Room; repaired: Record<Exclude<Room, 'corridor'>, boolean>};
