export const easterEggIds=['clock','coffee','snail','pigeon','router','extinguisher','book','bell','mailbox'] as const;
export type EasterEggId=typeof easterEggIds[number];
export function isEasterEgg(id:string):id is EasterEggId{return (easterEggIds as readonly string[]).includes(id);}
export const speakerAvatars:Record<string,string>={coffee:'engineer',clock:'clock',snail:'snail',pigeon:'pigeon',router:'router',extinguisher:'extinguisher',book:'book',bell:'bell',mailbox:'mailbox'};
