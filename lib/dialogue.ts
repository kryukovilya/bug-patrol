import type {EasterEggId} from './easter-eggs';

type Dialogue = {speaker:string;text:string};
const easterEggDialogues:Record<EasterEggId,Dialogue>={
 clock:{speaker:'Часы приёма',text:'Приём с 09:00 до 09:01. Обед с 09:00. Мы ценим ваше время — поэтому не тратим своё.'},
 coffee:{speaker:'Термос · техник',text:'Кофе «404»: бодрость не найдена. Зато кружка прошла нагрузочное тестирование.'},
 snail:{speaker:'Улитка · экспресс-доставка',text:'Ваш запрос очень важен для нас. Вы в очереди: первый. Ожидание: до следующего четверга.'},
 pigeon:{speaker:'Голубь · облачное хранилище',text:'Данные храню в облаке. Если облако улетит — это миграция.'},
 router:{speaker:'Маршрутизатор',text:'Wi-Fi без пароля. Без сигнала тоже. Зато безопасно.'},
 extinguisher:{speaker:'Огнетушитель',text:'Вскрывать при пожаре. При дедлайне — обнять и поплакать.'},
 book:{speaker:'README',text:'Инструкция прочитана. Теперь можно сделать вид, что так и планировал.'},
 bell:{speaker:'Почтовый звонок',text:'Для вызова сотрудника нажмите один раз. Для вызова его осуждения — семь.'},
 mailbox:{speaker:'Папка «Спам»',text:'Вы выиграли миллион гигабайт! Чтобы получить, отправьте нам ваш последний мегабайт.'}
};
export function inspectText(id:string):Dialogue{
 return easterEggDialogues[id as EasterEggId]??{speaker:'Курьер',text:'Нажмите на предмет или персонажа.'};
}
