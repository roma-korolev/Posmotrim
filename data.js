// Локальная база координат московских адресов (резервный вариант)
const moscowLocations = {
    "москва": { lat: 55.7558, lng: 37.6173 },
    "центр": { lat: 55.7558, lng: 37.6173 },
    "красная площадь": { lat: 55.7539, lng: 37.6208 },
    "кремль": { lat: 55.7520, lng: 37.6170 }
};

// База данных подборок
const collections = [
    { id: "atmosphere", name: "Хочу атмосферу", description: "События с особой атмосферой" },
    { id: "unusual", name: "Хочу что-то необычное", description: "Необычные и экспериментальные мероприятия" },
    { id: "free", name: "Бесплатные события", description: "Бесплатные мероприятия" },
    { id: "young-directors", name: "Молодые режиссёры", description: "Работы молодых режиссёров" },
    { id: "think", name: "Хочу подумать", description: "События для размышлений" },
    { id: "chamber", name: "Камерно", description: "Камерные мероприятия" },
    { id: "pushkin", name: "По пушкинской", description: "События, связанные с Пушкиным" }
];

// Функция для получения подсказок подборок (автокомплит)
function getCollectionSuggestions(query) {
    if (!query || query.length < 2) return [];
    
    const normalizedQuery = query.toLowerCase();
    return collections.filter(collection => 
        collection.name.toLowerCase().includes(normalizedQuery)
    );
}

// База данных мероприятий (загружается из events.js)
let events = eventsData || [];

// Функция для сохранения событий (теперь не используется, но оставлена для совместимости)
function saveEventsToStorage() {
    // События теперь хранятся в events.js, localStorage не используется
    console.log('События хранятся в events.js, localStorage не используется');
}

// Функция для получения координат по адресу (геокодинг)
async function getCoordinates(address) {
    // Сначала пробуем найти в локальной базе
    const normalizedAddress = address.toLowerCase()
        .replace('москва,', '')
        .replace('г. москва', '')
        .replace('ул.', '')
        .replace('улица', '')
        .replace('пер.', '')
        .replace('переулок', '')
        .replace('пр.', '')
        .replace('проспект', '')
        .replace('пл.', '')
        .replace('площадь', '')
        .replace('д.', '')
        .replace('дом', '')
        .replace('стр.', '')
        .replace('строение', '')
        .trim();
    
    // Проверяем точное совпадение
    if (moscowLocations[normalizedAddress]) {
        return moscowLocations[normalizedAddress];
    }
    
    // Проверяем частичное совпадение
    for (const key in moscowLocations) {
        if (normalizedAddress.includes(key) || key.includes(normalizedAddress)) {
            return moscowLocations[key];
        }
    }
    
    // Если не найдено локально, пробуем Open-Meteo API (бесплатный, без ключа)
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=ru&format=json`
        );
        const data = await response.json();
        
        if (data && data.results && data.results.length > 0) {
            return {
                lat: data.results[0].latitude,
                lng: data.results[0].longitude
            };
        }
        
        // Если Open-Meteo не сработал, пробуем Nominatim
        const nominatimResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const nominatimData = await nominatimResponse.json();
        
        if (nominatimData && nominatimData.length > 0) {
            return {
                lat: parseFloat(nominatimData[0].lat),
                lng: parseFloat(nominatimData[0].lon)
            };
        }
        
        return null;
    } catch (error) {
        console.error('Ошибка геокодинга:', error);
        // Если API не работает, возвращаем центр Москвы как запасной вариант
        console.log('Используем центр Москвы как запасной вариант');
        return { lat: 55.7558, lng: 37.6173 };
    }
}

// Функция для расчета расстояния по маршруту через OSRM API
async function calculateRouteDistance(lat1, lng1, lat2, lng2) {
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`
        );
        const data = await response.json();
        
        if (data && data.routes && data.routes.length > 0) {
            // Возвращаем расстояние в километрах
            return data.routes[0].distance / 1000;
        }
        
        // Если не удалось получить маршрут, используем прямое расстояние
        console.log('Не удалось получить маршрут, используем прямое расстояние');
        return calculateDistance(lat1, lng1, lat2, lng2);
    } catch (error) {
        console.error('Ошибка расчета маршрута:', error);
        // При ошибке используем прямое расстояние
        return calculateDistance(lat1, lng1, lat2, lng2);
    }
}

// Функция для расчета расстояния между двумя точками (формула гаверсинуса)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Функция для поиска ближайших событий
async function findNearestEvents(userAddress, maxDistance = 10, limit = 10) {
    const userCoords = await getCoordinates(userAddress);
    
    if (!userCoords) {
        console.error('Не удалось определить координаты адреса');
        return [];
    }
    
    // Добавляем расстояние к каждому событию (используем маршрутное расстояние)
    const eventsWithDistance = await Promise.all(events.map(async event => {
        const distance = await calculateRouteDistance(
            userCoords.lat, userCoords.lng,
            event.coords.lat, event.coords.lng
        );
        return {
            ...event,
            distance
        };
    }));
    
    // Фильтруем по максимальному расстоянию и сортируем
    const nearestEvents = eventsWithDistance
        .filter(event => event.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
    
    return nearestEvents;
}

// Функция для форматирования даты
function formatDate(start_date, end_date = null) {
    const startDate = new Date(start_date);
    const options = { 
        day: 'numeric', 
        month: 'long', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    
    if (end_date) {
        const endDate = new Date(end_date);
        const startFormatted = startDate.toLocaleDateString('ru-RU', options);
        const endOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
        const endFormatted = endDate.toLocaleDateString('ru-RU', endOptions);
        return `${startFormatted} — ${endFormatted}`;
    }
    
    return startDate.toLocaleDateString('ru-RU', options);
}

// Функция для форматирования цены
function formatPrice(price) {
    if (price === 0) return 'Бесплатно';
    return `от ${price} ₽`;
}

// Функция для получения названия типа события на русском
function getEventTypeName(type) {
    const types = {
        'theater': 'Театр',
        'cinema': 'Кино',
        'lecture': 'Лекция',
        'exhibition': 'Выставка',
        'public-talk': 'Паблик-ток',
        'other': 'Другое'
    };
    return types[type] || 'Другое';
}

// Иконка-заглушка для карточек событий без фото
const EVENT_PHOTO_PLACEHOLDER_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="#7A1030" stroke-width="1.6"/>
    <circle cx="8.5" cy="10" r="1.5" fill="#7A1030"/>
    <path d="M21 15l-5.5-5.5L7 18" stroke="#7A1030" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Расширения, которые перебираются, если у фото не указано расширение
// (гарантируется, что в папке images нет двух файлов с одинаковым именем без расширения)
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

// Есть ли у пути расширение файла
function hasImageExtension(path) {
    return /\.[a-zA-Z0-9]+$/.test(path);
}

// Возвращает первый вариант src и список остальных вариантов расширений
// для перебора, если путь указан без расширения
function resolveImageCandidates(path) {
    if (hasImageExtension(path)) {
        return { first: path, rest: [] };
    }
    const options = IMAGE_EXTENSIONS.map(ext => `${path}.${ext}`);
    return { first: options[0], rest: options.slice(1) };
}

// Строит <img> с автоматическим перебором расширений при ошибке загрузки.
// onFail: 'card-placeholder' — заменить содержимое .event-card-photo на иконку-заглушку,
//         'clear' — очистить родительский элемент,
//         иначе — просто скрыть картинку
function buildImgWithFallback(path, altText, onFail, extraAttrs = '') {
    const { first, rest } = resolveImageCandidates(path);
    return `<img src="${first}" alt="${altText}" data-candidates="${rest.join(',')}" data-tried="0" data-onfail="${onFail}" onerror="handleImageError(this)" ${extraAttrs}>`;
}

// Обработчик ошибки загрузки картинки: перебирает оставшиеся варианты расширений,
// а если ни один не подошёл — применяет запасное поведение (см. buildImgWithFallback)
function handleImageError(img) {
    const candidates = (img.dataset.candidates || '').split(',').filter(Boolean);
    const tried = parseInt(img.dataset.tried || '0', 10);

    if (tried < candidates.length) {
        img.dataset.tried = String(tried + 1);
        img.src = candidates[tried];
        return;
    }

    const onFail = img.dataset.onfail;
    if (onFail === 'card-placeholder') {
        const container = img.closest('.event-card-photo');
        if (container) {
            container.classList.add('event-card-photo--placeholder');
            container.innerHTML = EVENT_PHOTO_PLACEHOLDER_ICON;
        }
    } else if (onFail === 'clear') {
        img.parentElement.innerHTML = '';
    } else {
        img.style.display = 'none';
    }
}

// Возвращает HTML главного фото события для карточки (афиша, подборки).
// Если фото нет — показывает плейсхолдер, чтобы карточки были одинаковой высоты.
function renderEventCardPhoto(event) {
    if (event.photo) {
        return `<div class="event-card-photo">${buildImgWithFallback(event.photo, event.name, 'card-placeholder', 'loading="lazy"')}</div>`;
    }
    return `<div class="event-card-photo event-card-photo--placeholder">${EVENT_PHOTO_PLACEHOLDER_ICON}</div>`;
}

// Возвращает массив всех фото события для листалки на странице события:
// сначала главное фото, затем дополнительные фото из галереи
function getEventImages(event) {
    const images = [];
    if (event.photo) images.push(event.photo);
    if (Array.isArray(event.gallery)) {
        event.gallery.forEach(src => { if (src) images.push(src); });
    }
    return images;
}

// Функция для получения подсказок адресов (автокомплит)
async function getAddressSuggestions(query) {
    if (!query || query.length < 3) return [];
    
    // Сначала ищем в локальной базе
    const normalizedQuery = query.toLowerCase()
        .replace('москва,', '')
        .replace('г. москва', '')
        .replace('ул.', '')
        .replace('улица', '')
        .replace('пер.', '')
        .replace('переулок', '')
        .replace('пр.', '')
        .replace('проспект', '')
        .replace('пл.', '')
        .replace('площадь', '')
        .replace('д.', '')
        .replace('дом', '')
        .replace('стр.', '')
        .replace('строение', '')
        .trim();
    
    const localSuggestions = [];
    for (const key in moscowLocations) {
        if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
            localSuggestions.push({
                display: `Москва, ${key.charAt(0).toUpperCase() + key.slice(1)}`,
                address: `Москва, ${key.charAt(0).toUpperCase() + key.slice(1)}`
            });
        }
    }
    
    if (localSuggestions.length > 0) {
        return localSuggestions.slice(0, 5);
    }
    
    // Если не найдено локально, пробуем Nominatim с приоритетом Москвы
    try {
        // Сначала пробуем с Москвой
        const moscowResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Москва')}&limit=5&addressdetails=1&featuretype=`
        );
        const moscowData = await moscowResponse.json();
        
        if (moscowData && moscowData.length > 0) {
            // Фильтруем только адреса (содержат улицу, дом и т.д.)
            const addressResults = moscowData.filter(item => {
                const displayName = item.display_name.toLowerCase();
                return item.address && (item.address.road || item.address.street || item.address.building);
            });
            
            if (addressResults.length > 0) {
                return addressResults.slice(0, 5).map(item => ({
                    display: item.display_name,
                    address: item.display_name.split(',').slice(0, 3).join(',').trim()
                }));
            }
        }
        
        // Если в Москве не найдено, пробуем без ограничения
        const generalResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );
        const generalData = await generalResponse.json();
        
        if (generalData && generalData.length > 0) {
            // Фильтруем только адреса
            const addressResults = generalData.filter(item => {
                return item.address && (item.address.road || item.address.street || item.address.building);
            });
            
            if (addressResults.length > 0) {
                return addressResults.slice(0, 5).map(item => ({
                    display: item.display_name,
                    address: item.display_name.split(',').slice(0, 3).join(',').trim()
                }));
            }
        }
        
        return [];
    } catch (error) {
        console.error('Ошибка получения подсказок:', error);
        return [];
    }
}

// ============================================================
// Бургер-меню для телефонов (кнопку и id у <nav> скрипт добавляет сам)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const nav = header && header.querySelector('nav');
    const container = header && header.querySelector('.container');
    if (!header || !nav || !container) return;

    if (!nav.id) nav.id = 'site-nav';

    let burger = header.querySelector('.burger');
    if (!burger) {
        burger = document.createElement('button');
        burger.className = 'burger';
        burger.type = 'button';
        burger.setAttribute('aria-label', 'Меню');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-controls', nav.id);
        burger.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(burger);
    }

    const setOpen = (open) => {
        if (open) nav.style.top = (header.getBoundingClientRect().bottom + 8) + 'px';
        nav.classList.toggle('is-open', open);
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
    };

    burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', (e) => {
        if (!header.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 820) setOpen(false); });
    window.addEventListener('scroll', () => {
        if (nav.classList.contains('is-open')) nav.style.top = (header.getBoundingClientRect().bottom + 8) + 'px';
    }, { passive: true });
});

// ============================================================
// Три случайных кликабельных события в карточках на главной
// ============================================================
(function () {
    // Страница события: поменяйте, если называется иначе
    const EVENT_PAGE = 'event.html?id=';

    const COLORS = ['#7A1030', '#FFFFFF', '#7A1030']; // цвет иконки/тега по слотам: theatre, film, music

    function esc(v) {
        return String(v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function icon(type, c) {
        const s = `stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
        switch (type) {
            case 'cinema':
                return `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" ${s}/><path d="M3 10h18M7 6l2 4M12 6l2 4M17 6l2 4" ${s}/></svg>`;
            case 'theater':
                return `<svg viewBox="0 0 24 24" fill="none"><path d="M6 4c1.2 1.6 1.2 3.4 0 5-1.6 1.2-1.6 3.4 0 5 1.6 1.2 1.6 3.4 0 5" ${s}/><path d="M18 4c-1.2 1.6-1.2 3.4 0 5 1.6 1.2 1.6 3.4 0 5-1.6 1.2-1.6 3.4 0 5" ${s}/><circle cx="9" cy="9" r="1.1" fill="${c}"/><circle cx="15" cy="9" r="1.1" fill="${c}"/></svg>`;
            case 'exhibition':
                return `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" ${s}/><circle cx="8.5" cy="10" r="1.5" fill="${c}"/><path d="M21 15l-5.5-5.5L7 18" ${s}/></svg>`;
            case 'lecture':
            case 'public-talk':
                return `<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" ${s}/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" ${s}/></svg>`;
            default:
                return `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z" ${s}/></svg>`;
        }
    }

    function photoOrIcon(ev, i) {
        if (ev.photo && typeof buildImgWithFallback === 'function') {
            return buildImgWithFallback(ev.photo, esc(ev.name || ''), 'clear', 'loading="lazy"');
        }
        return icon(ev.type, COLORS[i]);
    }

    function fillCards() {
        const cards = document.querySelectorAll('.card-stack .floating-card');
        if (!cards.length || typeof events === 'undefined' || !Array.isArray(events) || !events.length) return;

        // Сначала предпочитаем события, которые ещё не закончились
        const now = Date.now();
        const upcoming = events.filter((e) => {
            const t = new Date(e.end_date || e.start_date).getTime();
            return isNaN(t) || t >= now;
        });
        const pool = upcoming.length >= cards.length ? upcoming : events;

        shuffle(pool).slice(0, cards.length).forEach((ev, i) => {
            const card = cards[i];
            const id = ev.id !== undefined ? ev.id : events.indexOf(ev);
            const tagStyle = i === 1 ? '' : ` style="color:${COLORS[i]};"`;
            const when = ev.start_date && typeof formatDate === 'function'
                ? formatDate(ev.start_date, ev.end_date || null) : '';

            card.href = EVENT_PAGE + encodeURIComponent(id);
            card.innerHTML =
                `<div class="icon-tile">${photoOrIcon(ev, i)}</div>` +
                `<span class="tag"${tagStyle}>${esc(typeof getEventTypeName === 'function' ? getEventTypeName(ev.type) : (ev.type || ''))}</span>` +
                `<span class="title">${esc(ev.name || '')}</span>` +
                `<span class="meta">${esc(when)}</span>`;
        });
    }

    document.addEventListener('DOMContentLoaded', fillCards);
})();