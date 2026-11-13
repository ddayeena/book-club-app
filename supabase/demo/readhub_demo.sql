-- SQL Editor / postgres / MAIN readhub, AFTER auth-demo.mjs succeeds.
-- Accepts ONLY the 24 new users created by that script (fresh-v2, one batch).
-- Never restores profiles or adopts old Auth accounts. No Auth SQL writes.
-- Run the WHOLE file. Nonempty application tables cause a safe refusal.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(20261112,11);

do $seed$
declare
 -- [name, genre, description, format, language, frequency, books,
 --  [topic, opening post, reply, reply], optional second conversation]
 catalog jsonb := $content$[
  ["Чорнило й магія","Фентезі","Збираємося заради складних чарівних світів і героїв, яким не завжди довіряємо. Читаємо без поспіху, а спойлери залишаємо для окремої розмови.","online","Українська",2,
   [["Шістка воронів","Лі Бардуґо"],["Жорстокий принц","Голлі Блек"],["Гобіт","Дж. Р. Р. Толкін"],["Чарівник Земномор’я","Урсула Ле Ґуїн"]],
   ["Чи довіряєте ви Джуд?","Мене зачепило, як Джуд намагається знайти місце у світі, який її відкидає. Її впертість — сила чи спосіб не помічати власного страху?","Для мене це передусім захист. Без її впертості історія була б значно коротшою.","А мені бракує обережності в її рішеннях. Співчуваю їй, але не кожен ризик виправданий."],
   ["Кого взяли б у команду Каза?","Після Шістки воронів ловлю себе на думці, що довіра тут важливіша за талант. Чий внесок у команду ви спершу недооцінили?","Джеспера. За його легкістю легко не помітити, як він тримає інших у складні моменти.","Для мене головна Інеж. Без її власних меж команда була б значно менш цікавою."]],
  ["Листи між сторінками","Романтика","Читаємо історії про близькість, другі шанси й невисловлені слова. Тут можна захоплюватися романтикою та сперечатися з авторським фіналом.","hybrid","Українська",2,
   [["Гордість і упередження","Джейн Остін"],["Джейн Ейр","Шарлотта Бронте"],["Розум і почуття","Джейн Остін"],["Переконання","Джейн Остін"]],
   ["Де проходить межа компромісу?","У Джейн мені подобається здатність захищати власну гідність. Яку її розмову ви перечитували уважніше за інші?","Розмови про незалежність. Здивувало, наскільки близькими вони залишаються сьогодні.","Мені роман дався повільно. Але саме завдяки паузам її вибір відчувається переконливим."]],
  ["Справа на вечір","Детективи","Зустрічаємося з нотатниками підозрюваних і чашкою чаю. До фінального обговорення не називаємо винного навіть натяками.","online","Українська",4,
   [["Убивство у «Східному експресі»","Аґата Крісті"],["Собака Баскервілів","Артур Конан Дойл"],["Убивство Роджера Екройда","Аґата Крісті"],["Місячний камінь","Вілкі Коллінз"]],
   ["Атмосфера сильніша за підказки?","Поки читаю про Баскервілів, постійно ловлю себе на недовірі до пейзажу. Чи допомагає вам похмура атмосфера розгадувати справу?","Я через неї підозрюю буквально всіх. Нотатки допомагають відділити факти від настрою.","Навпаки, пейзаж для мене важливіший за розгадку. Навіть знаючи фінал, повернувся б до цієї історії."]],
  ["Повільна класика","Класика","Одна книжка на місяць і жодних перегонів за кількістю прочитаного. Розбираємо деталі, переклади та питання, які пережили свою епоху.","offline","Українська",1,
   [["Портрет Доріана Ґрея","Оскар Вайлд"],["Гордість і упередження","Джейн Остін"],["Великий Ґетсбі","Френсіс Скотт Фіцджеральд"],["Буремний перевал","Емілі Бронте"]],
   ["Перше враження про Елізабет","Цікаво, як швидко я погодилася з оцінками Елізабет. Ви одразу помічали, де її судження можуть бути несправедливими?","На першому читанні майже ні. Зараз більше стежу за тим, що вона пропускає повз увагу.","Мене більше цікавить родинний тиск. Без нього багато її реакцій було б важко зрозуміти."]],
  ["Місто у тексті","Сучасна проза","Шукаємо в прозі знайомі двори, чужі міста та людей між ними. Любимо українські тексти й розмови без єдиної правильної інтерпретації.","hybrid","Українська",2,
   [["Інтернат","Сергій Жадан"],["Амадока","Софія Андрухович"],["Місто","Валер’ян Підмогильний"]],
   ["Як читати історію з прогалинами?","В Амадоці мене найбільше тримає тема пам’яті. Чи потрібно відновити всі зв’язки, щоб відчути цілісність роману?","Я дозволяю частині зв’язків лишитися неясними. Це нагадує справжню родинну пам’ять.","Мені потрібна схема персонажів. Без неї гублюся, хоча сама тема дуже близька."]],
  ["За межами орбіти","Наукова фантастика","Обговорюємо далекі планети й дуже людські проблеми. Наукова освіта не потрібна: достатньо цікавості та готовності ставити незручні запитання.","online","Українська",2,
   [["Дюна","Френк Герберт"],["Соляріс","Станіслав Лем"],["Ліва рука темряви","Урсула Ле Ґуїн"],["Марсіанин","Енді Вейр"]],
   ["Чи можлива розмова із Солярісом?","Люди в романі прагнуть пояснення, але чи готові вони зустріти щось справді незнайоме? Поки не бачу простої відповіді.","Мені здається, вони шукають радше дзеркало. Контакт вимагає відмови від знайомих рамок.","Я поки більше співчуваю їхній розгубленості. Вимагати повної відкритості в такій ситуації складно."],
   ["Яку екранізацію Дюни обговоримо?","Пропоную окрему зустріч після завершеного читання. Цікаво зіставити внутрішній голос Пола з тим, як його рішення виглядають на екрані.","Я за! Тільки домовмося, яку частину дивимося, щоб усі мали однаковий контекст.","Хотілося б більше часу залишити на книжку. Можемо винести кіно в необов’язковий вечір."]],
  ["Уважно до себе","Психологія","Читаємо про звички, увагу й людські рішення. Відділяємо особистий досвід від універсальних рецептів; наші зустрічі є книжковими розмовами, а не консультаціями.","online","Українська",2,
   [["Атомні звички","Джеймс Клір"],["Мислення швидке й повільне","Деніел Канеман"],["Людина в пошуках справжнього сенсу","Віктор Франкл"]],
   ["Де ви помічаєте швидкі висновки?","Після перших розділів ловлю себе на миттєвих оцінках книжкових обкладинок. Які побутові приклади допомогли зрозуміти ідеї автора?","Мені допомогли приклади з покупками. Тепер залишаю собі день на дорогі рішення.","Не хочу пояснювати кожну помилку одним упередженням. Контекст теж важливий, і його легко загубити."]],
  ["Відлуння століть","Історична проза","Зіставляємо історичні романи з питаннями сьогодення. Читаємо невеликими порціями та ділимося джерелами, якщо хочемо перевірити деталі епохи.","offline","Українська",2,
   [["Ім’я рози","Умберто Еко"],["Чорна рада","Пантелеймон Куліш"],["Захар Беркут","Іван Франко"]],
   ["Що робить історичну оповідь живою?","У Чорній раді мене захоплює зіткнення приватних бажань і спільних рішень. Що важливіше: побутові деталі чи конфлікт характерів?","Характери. Без них навіть точний опис епохи залишився б підручником.","Я люблю саме побутові деталі. Вони допомагають повірити у вибір персонажів."]],
  ["Дорослішати між рядками","Young adult","Простір для історій про дружбу, перші втрати та пошук себе. Вік у паспорті не має значення, а право не погоджуватися з героєм є в кожного.","online","Українська",2,
   [["Голодні ігри","Сюзанна Коллінз"],["Диво","Р. Дж. Паласіо"],["Крадійка книжок","Маркус Зузак"]],
   ["Чий погляд змінив ваше враження?","У романі Диво зміна оповідачів показує те, чого не помічає сам герой. Яка перспектива виявилася для вас найважливішою?","Історія сестри. Вона додає складності тому, що спершу здається очевидним.","Мені основний голос ближчий. Зміни перспектив іноді переривають емоційний зв’язок."]],
  ["Негучні історії","Коротка проза","Читаємо оповідання, які вміщуються в дорогу додому, а залишаються надовго. Приносьте одне спостереження замість великої рецензії.","hybrid","Українська",4,
   [["Камінний хрест","Василь Стефаник"],["Intermezzo","Михайло Коцюбинський"]],
   ["Чи відчуваєте ви тишу в тексті?","Intermezzo хочеться читати з паузами. Для вас описи природи тут є відпочинком чи підготовкою до повернення до людей?","Для мене це відновлення здатності чути. Після паузи людський голос звучить сильніше.","Я спершу сприймав їх як втечу. Тепер думаю, що ці два прочитання можуть співіснувати."]],
  ["Слова через кордони","Світова література","Читаємо англійською та українською, порівнюємо інтонації перекладів. Можна говорити тією мовою, якою легше сформулювати власну думку.","online","Українська та англійська",2,
   [["The Great Gatsby","F. Scott Fitzgerald"],["A Room of One’s Own","Virginia Woolf"],["Pride and Prejudice","Jane Austen"]],
   ["Яке слово ви перевіряли у перекладі?","У Вулф уважність до інтонації змінює відчуття аргументу. Зберімо місця, де переклад відкрив інший відтінок.","Мене зачепили переходи від іронії до серйозності. Читаю один абзац двома мовами.","Я поки читаю тільки українською. Хочу долучитися через обговорення образу кімнати."],
   ["Наш маленький читацький словник","Пропоную приносити на зустріч одне незнайоме слово з контекстом. Як зробити це корисним і не перетворити книжковий клуб на урок?","Можна обирати тільки слова, від яких залежить наше розуміння сцени. Решту залишати в особистих нотатках.","Мені подобається задум, якщо участь добровільна. Інколи хочеться просто поговорити про прочитане."]],
  ["Паперовий компас","Пригоди","Вирушаємо в подорожі сторінками, коли на справжню мандрівку бракує часу. Любимо карти, дивні маршрути та героїв, що повертаються іншими.","offline","Українська",1,
   [["Острів скарбів","Роберт Луїс Стівенсон"],["Навколо світу за вісімдесят днів","Жуль Верн"],["Робінзон Крузо","Данієль Дефо"]],
   ["Ви б погодилися на таку подорож?","Маршрут Фоґґа виглядає як суцільний розклад. Чи залишається місце для відкриттів, коли думаєш про наступний потяг?","Саме збої в розкладі й роблять мандрівку цікавою. Без них був би лише звіт.","Я люблю повільні подорожі, тому герой мене дратує. Але за пригодами стежу із задоволенням."]],
  ["Пам’ять на полях","Українська література","Повертаємося до українських книжок поза шкільним списком обов’язків. Шукаємо власні запитання до знайомих назв і відкриваємо пропущені голоси.","hybrid","Українська",2,
   [["Лісова пісня","Леся Українка"],["Тигролови","Іван Багряний"],["Місто","Валер’ян Підмогильний"]],
   ["Що для вас означає свобода Григорія?","У Тигроловах свобода відчувається не лише як втеча. Які рішення героя говорять про його внутрішню незалежність?","Мене переконує його готовність відповідати за інших. Самої сміливості було б замало.","Іноді герой здається надто безпомилковим. Хочу обговорити, чи це свідомий спосіб побудови пригоди."]],
  ["Кімната з віршами","Поезія","Обираємо небагато віршів і читаємо їх уголос. Не вимагаємо літературознавчих термінів: можна почати з ритму, образу або власного відчуття.","offline","Українська",2,
   [["Сонячні кларнети","Павло Тичина"],["Зів’яле листя","Іван Франко"]],
   ["Як змінює вірш читання вголос?","Зів’яле листя звучить по-різному залежно від темпу. Спробуйте прочитати улюблений вірш двічі й розкажіть, що змінилося.","Коли сповільнююся, чую більше стриманості, ніж відчаю. Це було несподівано.","А мені читання вголос заважає побути з текстом наодинці. На зустрічі спробую ще раз."]],
  ["Вечір без поспіху","Світова проза","Невеликий англомовний клуб для читання після роботи. Пояснюємо незнайомі слова одне одному й залишаємо час для розмови про саму історію.","online","Англійська",2,
   [["Animal Farm","George Orwell"],["The Old Man and the Sea","Ernest Hemingway"],["Fahrenheit 451","Ray Bradbury"]],
   ["What keeps Santiago going?","I keep thinking about the difference between persistence and refusing to stop. Where do you see that boundary in Santiago’s journey?","For me, his attention to the sea makes the persistence convincing. It is not just pride.","I read it more critically. Admiring his courage does not mean every decision feels wise."]]
 ]$content$::jsonb;
 users uuid[] := array[]::uuid[];
 expected_names text[] := array['Соломія Коваль','Марко Левицький','Олена Савчук','Андрій Мельник','Ірина Бондар','Тарас Шевчук','Наталія Романюк','Богдан Ткаченко','Дарина Мороз','Остап Кравець','Юлія Поліщук','Дмитро Гончар','Вероніка Лисенко','Роман Дорошенко','Катерина Сидоренко','Михайло Козак','Софія Павленко','Назар Климчук','Анастасія Бойко','Павло Руденко','Христина Іванюк','Денис Петренко','Зоряна Остапчук','Владислав Костенко'];
 i integer; j integer; k integer; day_offset integer; member_count integer; user_count integer;
 c jsonb; b jsonb; conversation jsonb;
 uid uuid; club uuid; bid uuid; poll uuid; option_id uuid; discussion uuid; request uuid;
 book_ids uuid[]; options uuid[]; days integer[];
 t text; n bigint; finished boolean; batch text;
 base timestamptz := now();
begin
 -- Read and stabilize real Auth IDs; no internal Auth writes.
 lock table auth.users in share mode;
 lock table public.profiles,public.user_access,public.clubs,public.club_members,
  public.join_requests,public.notifications,public.club_books,public.book_polls,
  public.book_poll_options,public.book_votes,public.club_meetings,
  public.club_discussions,public.club_discussion_comments in share row exclusive mode;
 foreach t in array array['clubs','club_members','join_requests','notifications','club_books',
   'book_polls','book_poll_options','book_votes','club_meetings','club_discussions','club_discussion_comments'] loop
  execute format('select count(*) from public.%I',t) into n;
  if n<>0 then raise exception 'Table % is not empty; seed aborted without changes',t; end if;
 end loop;

 if (select count(*) from auth.users)<>24 or (select count(*) from public.profiles)<>24
  or (select count(*) from public.user_access)<>24 then
  raise exception 'Потрібні рівно 24 НОВІ акаунти, профілі й ролі. Спочатку успішно запустіть auth-demo.mjs.';
 end if;
 select min(u.raw_app_meta_data->>'readhub_demo_batch') into batch from auth.users u;
 if batch is null or batch !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  or exists(select 1 from auth.users u where u.raw_app_meta_data->>'readhub_demo_version' is distinct from 'fresh-v2'
   or u.raw_app_meta_data->>'readhub_demo_batch' is distinct from batch) then
  raise exception 'Старі або змішані Auth-акаунти заборонені. Потрібен один новий пакет auth-demo.mjs.';
 end if;
 for i in 1..24 loop
  select u.id into strict uid from auth.users u
   join public.profiles p on p.id=u.id join public.user_access a on a.user_id=u.id
   where lower(u.email)='readhub.reader.'||lpad(i::text,2,'0')||'@example.com'
    and u.email_confirmed_at is not null and u.raw_app_meta_data->>'readhub_demo_index'=i::text
    and p.name=expected_names[i] and not p.reminders_enabled and a.role='user' and not a.is_blocked;
  users := array_append(users,uid);
 end loop;
 user_count := 24;

 for i in 0..jsonb_array_length(catalog)-1 loop
  c := catalog->i;
  insert into public.clubs(owner_id,name,genre,description,format,language,meetings_per_month,created_at)
   values(users[i%user_count+1],c->>0,c->>1,c->>2,c->>3,c->>4,(c->>5)::integer,base-interval '140 days') returning id into club;
  -- Owner membership is created by create_club RPC, NOT an INSERT trigger.
  -- This direct SQL path inserts it exactly once along with the other members.
  member_count := 4+i%6;
  for j in 0..member_count-1 loop
   insert into public.club_members(club_id,user_id,joined_at)
    values(club,users[(i+j)%user_count+1],base-interval '100 days');
  end loop;

  book_ids := array[]::uuid[];
  for j in 0..jsonb_array_length(c->6)-1 loop
   b := c->6->j;
   insert into public.club_books(club_id,title,author,status,started_at,completed_at,created_at)
    values(club,b->>0,b->>1,case j when 0 then 'completed' when 1 then 'current' else 'planned' end,
     case when j=0 then base-interval '70 days' when j=1 then base-interval '20 days' end,
     case when j=0 then base-interval '30 days' end,base-interval '90 days') returning id into bid;
   book_ids := array_append(book_ids,bid);
  end loop;

  if cardinality(book_ids)=4 then
   finished := i%2=0;
   insert into public.book_polls(club_id,title,created_at,ends_at)
    values(club,'Що читатимемо наступним?',base-case when finished then interval '12 days' else interval '2 days' end,
     base+case when finished then interval '-4 days' else interval '5 days' end) returning id into poll;
   options := array[]::uuid[];
   for j in 3..4 loop
    insert into public.book_poll_options(poll_id,club_id,book_id,position,title_snapshot,author_snapshot)
     select poll,club,id,j-2,title,author from public.club_books where id=book_ids[j] returning id into option_id;
    options := array_append(options,option_id);
   end loop;
   for j in 0..least(3+i%3,member_count)-1 loop
    insert into public.book_votes(poll_id,user_id,option_id,created_at,updated_at)
     values(poll,users[(i+j)%user_count+1],options[case when j=1 then 2 else 1 end],
      base-case when finished then interval '6 days' else interval '1 day' end,
      base-case when finished then interval '6 days' else interval '1 day' end);
   end loop;
   if finished then
    -- Option 1 has a strict majority. Candidates remain planned, selection unconsumed.
    update public.book_polls set finalized_at=base-interval '4 days',winner_option_id=options[1] where id=poll;
   end if;
  end if;

  days := array[3+i];
  if i%3=0 then days := array_append(days,12+i); end if;
  if i%2=0 then days := array_prepend(-30,days); end if;
  foreach day_offset in array days loop
   insert into public.club_meetings(club_id,title,starts_at,timezone,format,location,meeting_url,description,created_at)
    values(club,case when day_offset<0 then 'Після останньої сторінки: '||(c->6->0->>0)
      when day_offset=3+i then 'Читаємо разом: '||(c->6->1->>0) else 'Запитання до фіналу: '||(c->6->1->>0) end,
     (((base at time zone 'Europe/Kyiv')::date+day_offset)+time '19:00') at time zone 'Europe/Kyiv',
     'Europe/Kyiv',c->>3,
     case when c->>3<>'online' then 'Демонстраційна зустріч — місце узгодять учасники' end,
     case when c->>3<>'offline' then 'https://example.com/readhub/meeting/'||i::text||'/'||day_offset::text end,
     case when day_offset<0 then 'Історія демоспільноти: обмінялися враженнями від завершеної книги.'
       else 'Демонстраційна подія. Обговорюємо прочитане з повагою до різних думок; місце й посилання є прикладами.' end,
     base-interval '60 days');
  end loop;

  for k in 0..(case when jsonb_array_length(c)>8 then 1 else 0 end) loop
   conversation := c->(7+k);
   insert into public.club_discussions(club_id,author_id,book_id,title,body,created_at,updated_at)
    values(club,users[(i+k)%user_count+1],case when k=0 then book_ids[2] end,
     conversation->>0,conversation->>1,base-interval '3 days',base-interval '3 days') returning id into discussion;
   for j in 2..3 loop
    insert into public.club_discussion_comments(discussion_id,author_id,body,created_at,updated_at)
     values(discussion,users[(i+(j%member_count))%user_count+1],conversation->>j,
      base-interval '2 days'+j*interval '1 hour',base-interval '2 days'+j*interval '1 hour');
   end loop;
  end loop;

  if i<6 then
   insert into public.join_requests(club_id,applicant_id,motivation,weekly_hours,wants_reminders,experience,participation_format,contact_email,created_at)
    values(club,users[(i+member_count)%user_count+1],(array[
     'Давно шукаю компанію для розмов про фентезі. Люблю помічати дрібні деталі світу й повертатися до них після фіналу.',
     'Хочу перечитати знайомі романи без поспіху та почути інші думки про героїнь. До зустрічей зможу готувати короткі нотатки.',
     'Зазвичай розгадую детективи наодинці. Було б цікаво порівнювати версії з іншими читачами, не відкриваючи фінал завчасно.',
     'Повертаюся до класики після довгої перерви. Мені близький ваш спокійний темп і можливість обговорити складні місця.',
     'Читаю сучасну українську прозу й хочу краще розуміти різні погляди на пам’ять і місто. Можу долучатися двічі на місяць.',
     'Захоплююся фантастикою, де незвичний світ змушує інакше подивитися на людей. Хотів би обговорити Лема в невеликій компанії.'
    ])[i+1],3,true,case when i%2=0 then 'beginner' else 'regular' end,
     case when c->>3='hybrid' then 'any' else c->>3 end,'',base-interval '1 day') returning id into request;
   -- Notifications are normally written by submit_join_request RPC, not a trigger.
   insert into public.notifications(recipient_id,club_id,request_id,type,body,created_at)
    values(users[i%user_count+1],club,request,'new_request','Нова заявка до клубу «'||(c->>0)||'».',base-interval '1 day');
  end if;
 end loop;
 if (select count(*) from public.clubs)<>15
  or (select count(*) from public.club_members)<>93
  or (select count(*) from public.club_books)<>48 or (select count(*) from public.club_discussions)<>18
  or (select count(*) from public.club_discussion_comments)<>36 then
  raise exception 'Unexpected seed counts; all changes rolled back';
 end if;
 -- Integrated business checks: fail atomically before COMMIT.
 if (select count(*) from public.profiles)<>user_count
  or (select count(*) from public.user_access where role='user' and not is_blocked)<>user_count
  or exists(select 1 from public.user_access where role<>'user')
  or exists(select 1 from public.clubs c where not exists(select 1 from public.club_members m where m.club_id=c.id and m.user_id=c.owner_id))
  or exists(select 1 from public.join_requests r join public.club_members m on m.club_id=r.club_id and m.user_id=r.applicant_id)
  or exists(select 1 from public.book_votes v join public.book_polls p on p.id=v.poll_id
    where not exists(select 1 from public.club_members m where m.club_id=p.club_id and m.user_id=v.user_id)
      or v.created_at<p.created_at or v.created_at>=p.ends_at)
  or exists(select 1 from public.club_discussions d where not exists(select 1 from public.club_members m where m.club_id=d.club_id and m.user_id=d.author_id))
  or exists(select 1 from public.club_discussion_comments x join public.club_discussions d on d.id=x.discussion_id
    where not exists(select 1 from public.club_members m where m.club_id=d.club_id and m.user_id=x.author_id))
  or exists(select 1 from public.clubs c where (select count(*) from public.club_books b where b.club_id=c.id and b.status='current')<>1)
  or exists(select 1 from public.clubs c where not exists(select 1 from public.club_meetings m where m.club_id=c.id and m.starts_at>base))
  or exists(select 1 from public.book_polls p where p.finalized_at is not null and
    (select count(*) from public.book_votes v where v.poll_id=p.id and v.option_id=p.winner_option_id)<
    (select coalesce(max(q.total),0) from (select count(*) total from public.book_votes v where v.poll_id=p.id group by v.option_id) q)) then
  raise exception 'Перевірка зв’язків не пройшла; наповнення повністю скасовано';
 end if;
 if (select count(*) from public.book_polls)<>5
  or (select count(*) from public.book_polls where finalized_at is not null)<>2
  or (select count(*) from public.book_votes)<>20
  or (select count(*) from public.book_poll_options)<>10
  or (select count(*) from public.club_meetings)<>28
  or (select count(*) from public.join_requests)<>6
  or (select count(*) from public.notifications)<>6 then
  raise exception 'Неочікувані кількості; наповнення повністю скасовано';
 end if;
end $seed$;
commit;
select 'Готово. Використано лише 24 НОВІ акаунти з роллю user; наповнення й перевірки завершено.' as result,
 (select count(*) from public.profiles) as profiles,
 (select count(*) from public.clubs) as clubs,
 (select count(*) from public.club_members) as memberships,
 (select count(*) from public.club_books) as books,
 (select count(*) from public.book_polls) as polls,
 (select count(*) from public.book_votes) as votes,
 (select count(*) from public.club_meetings) as meetings,
 (select count(*) from public.club_discussions) as discussions,
 (select count(*) from public.club_discussion_comments) as comments,
 (select count(*) from public.join_requests) as requests,
 (select count(*) from public.notifications) as notifications;
