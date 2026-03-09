# Инструкция по деплою на Amvera

## Способ 1: Через GitHub (Рекомендуется)

### Шаг 1: Создай репозиторий на GitHub
1. Зайди на [github.com](https://github.com)
2. Нажми "New repository"
3. Назови его, например, `tanks-multiplayer`
4. Создай репозиторий (без README, .gitignore уже есть)

### Шаг 2: Загрузи код
Открой терминал в папке `tanks-amvera` и выполни:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/твой-username/tanks-multiplayer.git
git push -u origin main
```

### Шаг 3: Деплой на Amvera
1. Зайди на [amvera.ru](https://amvera.ru)
2. Зарегистрируйся или войди
3. Нажми "Создать проект"
4. Выбери "Из GitHub"
5. Подключи свой GitHub аккаунт
6. Выбери репозиторий `tanks-multiplayer`
7. Amvera автоматически обнаружит настройки из `amvera.yml`
8. Нажми "Создать"

### Шаг 4: Дождись деплоя
- Amvera установит зависимости и запустит сервер
- Это займет 2-3 минуты
- После деплоя получишь ссылку типа `https://твой-проект.amvera.app`

### Шаг 5: Играй!
- Открой ссылку в браузере
- Отправь друзьям
- Наслаждайся игрой!

---

## Способ 2: Через Amvera CLI

### Установка CLI
```bash
npm install -g @amvera/cli
```

### Логин
```bash
amvera login
```

### Деплой
```bash
cd tanks-amvera
amvera deploy
```

---

## Обновление проекта

### Через GitHub
1. Внеси изменения в код
2. Закоммить и запушь:
```bash
git add .
git commit -m "Update game"
git push
```
3. Amvera автоматически задеплоит новую версию

### Через CLI
```bash
amvera deploy
```

---

## Проверка логов

### В веб-панели Amvera
1. Открой свой проект
2. Перейди в раздел "Логи"
3. Смотри логи в реальном времени

### Через CLI
```bash
amvera logs
```

---

## Настройки окружения

Если нужны переменные окружения:
1. В панели Amvera открой проект
2. Перейди в "Настройки" → "Переменные окружения"
3. Добавь нужные переменные

---

## Важно!

- Amvera автоматически определяет порт через `process.env.PORT`
- Не нужно настраивать Cloudflare Tunnel
- WebRTC голосовой чат работает P2P (напрямую между игроками)
- Бесплатный план Amvera может иметь ограничения по ресурсам

---

## Troubleshooting

### Проект не запускается
- Проверь логи в панели Amvera
- Убедись что `amvera.yml` правильно настроен
- Проверь что Node.js версия 18+

### Ошибка при установке зависимостей
- Проверь что `package.json` корректный
- Попробуй удалить `package-lock.json` и задеплоить снова

### Игра лагает
- Проверь пинг до сервера
- Возможно нужен платный план Amvera для большего количества игроков

---

## Полезные ссылки

- [Документация Amvera](https://docs.amvera.ru)
- [Amvera CLI](https://www.npmjs.com/package/@amvera/cli)
- [GitHub](https://github.com)
