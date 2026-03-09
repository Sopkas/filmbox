# Google OAuth для KinoPulse

## 1. Где взять `Client ID`
1. Открой Google Cloud Console: `https://console.cloud.google.com/`
2. Создай новый проект или выбери существующий.
3. Перейди в `APIs & Services` -> `OAuth consent screen`.
4. Заполни обязательные поля:
   - `App name`
   - `User support email`
   - `Developer contact email`
5. Сохрани настройки consent screen.
6. Перейди в `APIs & Services` -> `Credentials`.
7. Нажми `Create Credentials` -> `OAuth client ID`.
8. Тип клиента: `Web application`.
9. В `Authorized JavaScript origins` добавь:
   - `http://localhost:5173`
   - `http://localhost:5174` (если используешь этот порт)
10. Нажми `Create`.
11. Скопируй `Client ID` (строка вида `xxxx.apps.googleusercontent.com`).

## 2. Что прописать в `.env`

### `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

### `backend/.env`
```env
PORT=4000
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
MOCK_GOOGLE=false
```

## 3. Перезапуск после изменений
После правок `.env` обязательно перезапусти оба сервера:
1. backend
2. frontend

Без перезапуска Vite/Node не подхватят новые переменные окружения.

## 4. Проверка
1. Открой страницу входа.
2. Должна появиться кнопка `Или войти через Google`.
3. Нажми кнопку и авторизуйся через Google.

## 5. Если кнопки нет
Проверь:
1. `VITE_GOOGLE_CLIENT_ID` не пустой в `frontend/.env`.
2. `GOOGLE_CLIENT_ID` не пустой в `backend/.env`.
3. Origin (`http://localhost:5173`) добавлен в Google OAuth client.
4. Оба сервера перезапущены после изменения `.env`.
5. В браузере нет блокировки pop-up для Google входа.

## 6. Полезно для продакшена
1. Добавь прод-домен в `Authorized JavaScript origins`.
2. Добавь этот же домен в `CORS_ORIGIN` на backend.
3. Для продакшена используй `NODE_ENV=production`.
