# Wash.bot

Навчальний MVP для запису великогабаритного транспорту на сервіс через Telegram-бота, Django backend і майбутню операційну панель для персоналу.

## Структура проєкту

```text
Wash.bot/
  backend/
    manage.py
    db.sqlite3
    washbot/
    accounts/
    booking/
    operations/
    contracts/
    pricing/
  bot/
  admin_panel/
```

## Django backend

`backend/washbot/` - це Django project package. Тут живе конфігураційний шар проєкту:

- `settings.py` - підключені apps, база даних, timezone, middleware.
- `urls.py` - головний роутинг. Зараз `/api/` передається в `booking.urls`.
- `wsgi.py` / `asgi.py` - точки входу для запуску Django.

//TODO : потім видалити Логін: admin
//TODO: потім видалити Пароль: WashBot-Admin-2026!

Це не бізнес-домен, а каркас Django-проєкту.

## Admin panel

### Local launch guide: PC only vs local network

The admin panel reads backend URL from `VITE_API_BASE_URL`.

If this variable is not set, frontend uses the default from `admin_panel/src/api/httpClient.ts`:

```text
http://127.0.0.1:8000/api
```

#### PC only

Use this mode when frontend and backend are opened only on the same computer.

Backend:

```powershell
cd backend
python manage.py runserver
```

Frontend:

```powershell
cd admin_panel
Remove-Item Env:VITE_API_BASE_URL
npm run dev
```

Open:

```text
http://localhost:5173
```

#### Local network: phone or another device

Use this mode when opening the admin panel from a phone or another computer in the same Wi-Fi/LAN.

Backend:

```powershell
cd backend
python manage.py runserver 0.0.0.0:8000
```

Frontend:

```powershell
cd admin_panel
$env:VITE_API_BASE_URL="http://192.168.50.214:8000/api"
npx vite --host 0.0.0.0
```

Open on the phone:

```text
http://192.168.50.214:5173
```

Important:

- `127.0.0.1` means "this same device".
- On a phone, `127.0.0.1` means the phone itself, not the development PC.
- If backend is started with plain `python manage.py runserver`, it listens only on `127.0.0.1:8000`.
- For LAN access, backend must be started with `0.0.0.0:8000`.
- If switching back from LAN mode to PC-only mode, remove `VITE_API_BASE_URL` or open a fresh terminal.
- If frontend opens from the phone but API requests fail with `ERR_CONNECTION_REFUSED`, backend is usually not listening on `0.0.0.0:8000` or Windows Firewall is blocking `python.exe`.

`admin_panel/` - це майбутня кастомна операційна панель для персоналу. Вона відрізняється від стандартного Django admin.

```text
Django admin = керування моделями та довідниками
admin_panel = робочий інтерфейс оператора
```

Майбутня панель потрібна для щоденної роботи з бронюваннями:

```text
календар бронювань
перегляд операційного вікна
перенесення бронювання
скасування бронювання
ручне корегування даних
майбутні операторські сценарії
```

## Домен `accounts`

`backend/accounts/` відповідає за профілі персоналу та базові ролі доступу для Django admin і майбутньої `admin_panel`.

Важлива межа:

```text
django.contrib.auth.User = логін, пароль, email, is_staff, групи та permissions
accounts.AdminOperatorProfile = бізнесовий профіль працівника поверх стандартного User
operations.OperatorContact = публічний контакт оператора для клієнтів/бота
```

`AdminOperatorProfile` прив'язується до стандартного Django `User` через `OneToOneField` і зберігає тільки ті дані, яких немає у стандартній auth-моделі:

- `role` - роль у системі: `superadmin`, `administrator`, `operator`;
- `location` - локація, до якої прив'язаний працівник;
- `phone`;
- `telegram_user_id` - стабільний Telegram ID для майбутнього відновлення доступу через Telegram;
- `telegram_username` - зручне відображення Telegram username;
- `can_reset_password_via_telegram` - дозвіл на майбутній сценарій reset-пароля через Telegram;
- `is_active` - активність профілю.

Паролі не зберігаються в `AdminOperatorProfile`. Вони залишаються в стандартному Django `User`.

### Ролі та групи доступу

Після `manage.py migrate` система автоматично створює та оновлює Django groups:

```text
superadmins
administrators
operators
```

Права груп:

```text
superadmins
  усі permissions у системі

administrators
  можуть додавати та змінювати користувачів
  можуть керувати профілями персоналу
  можуть налаштовувати бізнес-логіку:
    локації, графіки, перерви, пости, послуги, опції, прайси, контракти, нагадування

operators
  можуть керувати записами на мийку:
    читати, додавати, змінювати, видаляти Booking
    читати, додавати, змінювати, видаляти BookingPostAllocation
    читати, додавати, змінювати, видаляти Client
  можуть читати довідники, потрібні для роботи із записами
  не можуть додавати користувачів або змінювати бізнес-налаштування
```

Коли зберігається `AdminOperatorProfile`, роль автоматично синхронізується з Django-групою:

```text
role=superadmin      -> group=superadmins
role=administrator   -> group=administrators
role=operator        -> group=operators
```

Користувач також автоматично отримує `is_staff=True`, щоб мати доступ до Django admin. Для майбутньої `admin_panel` додане окреме permission `accounts.access_admin_panel`.

## Домен `booking`

`backend/booking/` відповідає за бронювання:

- каталог послуг і типів транспорту;
- доступність слотів;
- створення бронювання;
- розподіл бронювання по сервісних постах.

Основні моделі:

- `VehicleGroup` - група транспорту.
- `VehicleType` - конкретний тип транспорту.
- `Service` - загальна послуга.
- `ServiceOffering` - конкретна пропозиція: послуга + тип транспорту + ціна + тривалість.
- `ServiceOption` - додаткова опція до бронювання.
- `ServiceOfferingOption` - зв'язок між конкретним `ServiceOffering` і дозволеною додатковою опцією; через нього можна залишити пропозицію без опцій або задати власні override-ціну/тривалість для опції.
- `ServicePost` - сервісний пост/бокс/ресурс, який належить локації та може виконувати певні послуги або опції.
- `Client` - клієнт із Telegram/contact даними.
- `Booking` - запис клієнта на конкретну послугу.
- `BookingPostAllocation` - етап виконання бронювання на конкретному пості.

### Service-шар у `booking`

Бізнес-логіка винесена з `views.py` у пакет:

```text
backend/booking/services/
  allocation.py
  availability.py
  booking_creation.py
  catalog.py
  errors.py
  identifiers.py
```

`views.py` тепер є тонким HTTP-шаром: приймає запит, викликає service-шар і повертає `JsonResponse`.

Додаткові опції тепер пропонуються не глобально для всіх послуг, а через `ServiceOfferingOption`.
Фінальна доступність опції визначається так:

1. опція прив'язана до конкретного `ServiceOffering`;
2. зв'язок і сама опція активні;
3. `ServiceOption.applicable_group` / `applicable_vehicle_type`, якщо заповнені, відповідають групі або типу транспорту в offering.

Якщо в `ServiceOffering` немає активних `ServiceOfferingOption`, бот залишає тільки основну сервісну послугу без кроку вибору додаткових опцій.

## Домен `operations`

`backend/operations/` відповідає за операційні налаштування бізнесу. Це те, що має змінюватися через Django admin без зміни коду й без деплою.

Основні моделі:

- `BusinessSettings` - глобальні бізнес-налаштування, наприклад крок слотів і кількість днів для бронювання наперед.
- `Location` - локація/філія сервісу з адресою та геокоординатами.
- `BusinessHours` - робочі години локації по днях тижня.
- `ServicePostHours` - індивідуальні робочі години конкретного поста, якщо він працює не так, як локація.
- `WorkBreak` - перерви всередині робочого дня для всієї локації або конкретного поста.
- `OperatorContact` - телефони та Telegram-контакти операторів.

### Локації та пости

Поточна модель така:

```text
Location
  має багато ServicePost

ServicePost
  належить одній Location
  підтримує певні Service
  підтримує певні ServiceOption

BookingPostAllocation
  резервує конкретний ServicePost на конкретний проміжок часу
```

Робочі години мають два рівні:

```text
BusinessHours
  базовий графік локації

ServicePostHours
  optional override-графік поста
```

Якщо для поста немає власного `ServicePostHours`, він працює за графіком своєї локації. Якщо власний графік є, availability використовує саме його.

Перерви працюють схожим чином:

```text
WorkBreak без service_post
  перерва всієї локації

WorkBreak із service_post
  перерва тільки конкретного поста
```

Слот вважається доступним тільки тоді, коли потрібний маршрут по постах можна виконати з урахуванням графіка локації, графіка конкретних постів, перерв і вже існуючих бронювань.

## Домен `contracts`

`backend/contracts/` відповідає за B2B-клієнтів і контрактні умови обслуговування.

Цей домен не створює бронювання напряму. Його майбутня роль - відповісти на питання:

```text
який B2B-клієнт пов'язаний із транспортом
який активний договір діє
які послуги й опції дозволені
які ціни й тривалості треба застосувати замість retail-прайсу
```

Основні моделі:

- `Company` - B2B-клієнт або юридична особа.
- `Contract` - договір із компанією: номер, статус, період дії, умови оплати, нотатки.
- `ContractVehicle` - транспортний засіб, який входить у конкретний договір.
- `ContractServiceRule` - контрактні умови для конкретного `ServiceOffering`: дозволено/заборонено, індивідуальна ціна, індивідуальна тривалість.
- `ContractOptionRule` - контрактні умови для конкретної `ServiceOption`: дозволено/заборонено, індивідуальна ціна, індивідуальна додаткова тривалість.

### Retail vs contract

Retail-прайс поступово винесений у домен `pricing`.
Поля `booking.ServiceOffering.price` і `booking.ServiceOption.price` поки лишаються legacy fallback, щоб існуючий каталог не ламався під час переходу.

Контрактні правила працюють як override:

```text
retail клієнт
  використовує default retail PriceList
  якщо ціни в прайс-листі немає, fallback на ServiceOffering.price / ServiceOption.price
  використовує ServiceOffering.duration_minutes
  використовує ServiceOption.extra_duration_minutes

contract клієнт
  визначається через ContractVehicle
  використовує ContractServiceRule, якщо правило існує
  використовує ContractOptionRule, якщо правило існує
```

Майбутній booking flow для B2B:

```text
1. Клієнт або оператор вводить номер транспорту.
2. Система шукає активний ContractVehicle.
3. Якщо транспорт контрактний:
   - визначає Company;
   - знаходить Contract;
   - застосовує ContractServiceRule і ContractOptionRule;
   - створює booking як contract.
4. Якщо транспорт не контрактний:
   - працює стандартний retail-flow.
```

Важлива межа:

```text
contracts = комерційні умови B2B
operations = фізична можливість виконати роботу
booking = факт бронювання й резервування постів
```

## Домен `pricing`

`backend/pricing/` відповідає за прайс-листи та обрахунок комерційних умов для чернетки бронювання.

Основні моделі:

- `PriceList` - набір цін: retail або contract, валюта, активність, ознака default.
- `ServiceOfferingPrice` - ціна конкретної основної послуги (`ServiceOffering`) у прайс-листі.
- `ServiceOptionPrice` - ціна конкретної додаткової опції (`ServiceOption`) у прайс-листі.

Перший етап міграції:

```text
pricing.PriceList
  основне місце налаштування retail-цін

booking.ServiceOffering.price / booking.ServiceOption.price
  legacy fallback, якщо позиція прайс-листа ще не створена
```

Цей домен поєднує retail price list із контрактними override-правилами:

```text
PriceList / ServiceOfferingPrice / ServiceOptionPrice
  базові retail-ціни

ServiceOffering / ServiceOption
  базові операційні тривалості

ContractServiceRule / ContractOptionRule
  B2B override для ціни, тривалості або дозволеності

pricing.services.resolve_pricing_terms()
  повертає ефективну ціну, ефективну тривалість і billing mode
```

API:

```text
POST /api/pricing/resolve/
```

Приклад payload:

```json
{
  "serviceId": "wash",
  "vehicleNumber": "AA1234KL",
  "billingMode": "auto",
  "optionIds": []
}
```

Приклад результату для контрактного транспорту:

```text
billingMode = contract
contractFound = true
offeringId = wash__bus_double
vehicleTypeId = bus_double
totalPrice = контрактна ціна
totalDurationMinutes = контрактна тривалість
```

Якщо номер транспорту є в контрактних даних, але транспорт, компанія або договір неактивні, `pricing` не відмовляє клієнту. Він повертає:

```text
billingMode = retail
contractFound = false
contractMatched = true
contractUnavailableReason = vehicle_inactive / contract_not_active / ...
```

Бот у такому випадку пояснює ситуацію й продовжує звичайний retail-сценарій.

`booking` і `availability` тепер використовують `pricing`, тому контрактна тривалість впливає не лише на суму, а й на доступні слоти та алокації постів.

Важлива межа:

```text
pricing = скільки коштує
booking/service catalog = що саме виконується і скільки часу базово займає
operations = де фізично можна виконати роботу
contracts = для кого діють особливі правила
```

Команда `seed_demo_data` створює default retail прайс-лист `retail-default` із поточних catalog-цін.

## Нормалізація даних

`backend/common/normalization.py` містить спільні helper-и для нормалізації людського вводу.

Зараз нормалізується номер транспорту:

```text
aa 1234 kl
AA-1234-KL
АА 1234 КЛ
```

усе приводиться до:

```text
AA1234KL
```

Це потрібно, щоб контрактний транспорт знаходився навіть тоді, коли користувач ввів номер із пробілами, дефісами або кириличними літерами, схожими на латинські.

У БД зберігаються два значення:

```text
vehicle_number
  як номер показується людині

normalized_vehicle_number
  стабільний ключ для пошуку й matching
```

`ContractVehicle` шукається через `normalized_vehicle_number`. `Booking` також має `normalized_vehicle_number`, щоб історію бронювань можна було шукати стабільно.

## `.env` чи база даних?

`.env` варто використовувати для технічної конфігурації:

```text
BOT_TOKEN
API_BASE_URL
SECRET_KEY
DATABASE_URL
DEBUG
ALLOWED_HOSTS
```

База даних/admin потрібні для бізнесових і операційних налаштувань:

```text
робочі години
крок слотів
перерви
вихідні або святкові дні
телефони операторів
геолокаційні точки
адреси локацій
правила доступності
B2B-компанії
контракти
контрактний транспорт
контрактні ціни й тривалості
користувачі персоналу
ролі та права доступу
```

Коротке правило:

```text
.env = як система підключається і запускається
DB/admin = як бізнес працює щодня
```

## API

Поточні endpoints:

```text
GET  /api/catalog/
GET  /api/availability/
POST /api/bookings/
```

`availability` вже використовує `operations.services.get_schedule_for_date()` і перевіряє доступність конкретних постів. Тобто доступні слоти рахуються на основі графіка локації, optional-графіка постів, перерв і зайнятих `BookingPostAllocation`.

Контрактна логіка вже використовується у pricing/availability/booking creation через `billingMode`, `vehicleNumber` і contract rules.

## Telegram bot

`bot/` містить TypeScript-версію клієнтської частини Telegram-бота.

Поточний статус:

- flow і рендери вже зроблені;
- технічні змінні беруться з `.env`;
- реальний зв'язок із Django API поступово замінює stub repository;
- створення бронювання має йти через `/api/bookings/`.
- після вибору послуги бот просить номер транспорту;
- якщо номер знайдено в активному контракті, бот автоматично використовує режим `за договором`;
- якщо контрактний запис знайдено, але він недоступний, бот пояснює причину й продовжує як `retail`;
- ціна й тривалість рахуються backend endpoint-ом `/api/pricing/resolve/`.

## Запуск backend

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

`migrate` також створює/оновлює групи доступу `superadmins`, `administrators`, `operators`.

## Тестові дані

Для локальної розробки є команда, яка наповнює базу демо-даними:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py seed_demo_data
```

Команду можна запускати повторно. Вона оновлює демо-записи, а не створює дублікати.

Що додається:

```text
операційні налаштування на 14 днів перегляду
демо-оператор
демо-перерва
індивідуальний графік одного поста
B2B-компанія KLR Logistics Demo
контракт KLR-DEMO-2026
2 контрактні транспортні засоби
контрактні правила для послуг і опцій
1 retail demo booking
1 contract demo booking
```

Перевірка Django:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py check
```
