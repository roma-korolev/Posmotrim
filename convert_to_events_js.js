const fs = require('fs');

// Читаем events.json
let content = fs.readFileSync('events.json', 'utf8');

// Удаляем лишние скобки если есть
content = content.trim();
if (content.startsWith('[[') && content.endsWith(']]')) {
    content = content.substring(1, content.length - 1);
}

// Более умное исправление кавычек
let fixed = '';
let inString = false;
let escapeNext = false;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escapeNext) {
        fixed += char;
        escapeNext = false;
        continue;
    }
    
    if (char === '\\') {
        escapeNext = true;
        fixed += char;
        continue;
    }
    
    if (char === '"') {
        if (inString) {
            // Проверяем, это конец строки
            const nextChar = content[i + 1];
            if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ' ' || nextChar === '\n' || nextChar === undefined) {
                inString = false;
            } else {
                // Это кавычка внутри строки - экранируем её
                fixed += '\\"';
                continue;
            }
        } else {
            // Проверяем, это начало строки
            const prevChar = content[i - 1];
            if (prevChar === ':') {
                inString = true;
            }
        }
    }
    
    fixed += char;
}

// Парсим JSON
let events;
try {
    events = JSON.parse(fixed);
    console.log('JSON успешно распарсен!');
} catch (e) {
    console.log('Ошибка парсинга JSON:', e.message);
    console.log('Позиция ошибки:', e.message.match(/position (\d+)/)?.[1]);
    process.exit(1);
}

// Создаем events.js
const jsContent = "// События (загружаются из файла)\nconst eventsData = " + JSON.stringify(events, null, 4) + ";\n";

fs.writeFileSync('events.js', jsContent, 'utf8');

console.log(`Успешно конвертировано ${events.length} событий в events.js`);
