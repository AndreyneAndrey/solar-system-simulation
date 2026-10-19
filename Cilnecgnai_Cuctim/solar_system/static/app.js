const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');

// Элементы управления
const zoomSlider = document.getElementById('zoomSlider');
const zoomValueDisplay = document.getElementById('zoomValue');
const speedSlider = document.getElementById('speedSlider');
const speedValueDisplay = document.getElementById('speedValue');
const pauseBtn = document.getElementById('pauseBtn');

// Элементы карточки подсказки
const planetCard = document.getElementById('planetCard');
const cardTitle = document.getElementById('cardTitle');
const cardDist = document.getElementById('cardDist');
const cardRad = document.getElementById('cardRad');
const cardOrbitSpeed = document.getElementById('cardOrbitSpeed');
const cardLocalYears = document.getElementById('cardLocalYears');
const cardLocalDays = document.getElementById('cardLocalDays');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Состояние камеры
let scale = 30; 
let offsetX = canvas.width / 2; 
let offsetY = canvas.height / 2;
let isDragging = false;
let startX, startY;

const AU_PIXELS = 100; 

// Глобальный счетчик времени симуляции в НАСТОЯЩИХ ЗЕМНЫХ СУТКАХ со старта Точки 0
let earthDaysTime = 0; 

// Управление скоростью времени
let timeSpeed = 1.0; 
let isPaused = false;

// База координат для отслеживания мыши
let renderedPlanets = [];

// Предзагрузка картинок
const images = {};
let loadedImagesCount = 0;
const totalImages = planetsData.length + 1; // Только планеты + Солнце

function preloadImages(callback) {
    images[sunData.name] = new Image();
    images[sunData.name].src = sunData.imageSrc;
    images[sunData.name].onload = checkLoad;

    planetsData.forEach(planet => {
        images[planet.name] = new Image();
        images[planet.name].src = planet.imageSrc;
        images[planet.name].onload = checkLoad;
    });

    function checkLoad() {
        loadedImagesCount++;
        if (loadedImagesCount === totalImages) {
            callback();
        }
    }
}

// --- НАСТРОЙКА ВРЕМЕНИ ---
speedSlider.addEventListener('input', (e) => {
    timeSpeed = parseFloat(e.target.value) / 100;
    speedValueDisplay.textContent = timeSpeed.toFixed(1) + "x";
});

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
        pauseBtn.textContent = "Продолжить";
        pauseBtn.classList.add('paused');
    } else {
        pauseBtn.textContent = "Пауза";
        pauseBtn.classList.remove('paused');
    }
});

// --- ЗУМ И ДРАГ КАМЕРЫ ---
zoomSlider.addEventListener('input', (e) => {
    const newScale = parseFloat(e.target.value);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    offsetX = centerX - (centerX - offsetX) * (newScale / scale);
    offsetY = centerY - (centerY - offsetY) * (newScale / scale);
    scale = newScale;
    zoomValueDisplay.textContent = Math.round(scale) + "x";
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newScale = scale;
    if (e.deltaY < 0) newScale = Math.min(scale * zoomFactor, 1000);
    else newScale = Math.max(scale / zoomFactor, 1);
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
    offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
    scale = newScale;
    
    zoomSlider.value = scale;
    zoomValueDisplay.textContent = Math.round(scale) + "x";
});

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
});

// --- ОТСЛЕЖИВАНИЕ НАВЕДЕНИЯ МЫШИ ---
window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
        planetCard.style.display = 'none'; 
        return;
    }

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    let hoveredPlanet = null;

    for (let i = 0; i < renderedPlanets.length; i++) {
        const p = renderedPlanets[i];
        const dist = Math.hypot(mouseX - p.screenX, mouseY - p.screenY);
        if (dist <= Math.max(p.radius, 15)) { 
            hoveredPlanet = p.data;
            break;
        }
    }

    if (hoveredPlanet) {
        cardTitle.textContent = hoveredPlanet.name;
        
        if (hoveredPlanet.name === "Солнце") {
            cardDist.textContent = "Центр системы";
            cardRad.textContent = "Радиус: 109x от Земли";
            cardOrbitSpeed.textContent = "Звезда";
            cardLocalYears.textContent = "Система работает: " + Math.floor(earthDaysTime) + " земных суток";
            cardLocalDays.textContent = "Собственное вращение: отсутствует";
        } else {
            cardDist.textContent = "Дистанция: " + hoveredPlanet.distance + " а.е.";
            cardRad.textContent = "Радиус: " + hoveredPlanet.radius + " от Земли";
            cardOrbitSpeed.textContent = "Орбитальный коэф.: " + hoveredPlanet.orbitSpeed;
            
            const realYearInEarthDays = 365.25 / hoveredPlanet.orbitSpeed;
            const localYears = earthDaysTime / realYearInEarthDays;
            cardLocalYears.textContent = "Пройдено местных лет: " + localYears.toFixed(2);
            
            const localDaysCalculated = earthDaysTime * Math.abs(hoveredPlanet.rotateSpeed);
            cardLocalDays.textContent = "Текущие сутки планеты: " + Math.floor(localDaysCalculated);
        }
        
        planetCard.style.left = (mouseX + 15) + "px";
        planetCard.style.top = (mouseY + 15) + "px";
        planetCard.style.display = 'block';
    } else {
        planetCard.style.display = 'none';
    }
});

window.addEventListener('mouseup', () => { isDragging = false; });

// --- ГЛАВНЫЙ ЦИКЛ ОТРИСОВКИ ---
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(offsetX, offsetY); 
    
    renderedPlanets = []; 
    
    // 1. Солнце
    const visualSunRadius = Math.log10(sunData.radius) * 22 * (scale / 30);
    ctx.save();
    ctx.shadowBlur = visualSunRadius * 0.4;
    ctx.shadowColor = "#ffaa00";
    if (images[sunData.name]) {
        ctx.drawImage(images[sunData.name], -visualSunRadius, -visualSunRadius, visualSunRadius * 2, visualSunRadius * 2);
    }
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = Math.max(12, visualSunRadius * 0.25) + "px Arial";
    ctx.fillText(sunData.name, visualSunRadius + 8, 5);

    renderedPlanets.push({ screenX: offsetX, screenY: offsetY, radius: visualSunRadius, data: sunData });

    // 2. Планеты
    planetsData.forEach(planet => {
        const orbitRadius = planet.distance * AU_PIXELS * (scale / 10);
        
        // Линия орбиты
        ctx.beginPath();
        ctx.arc(0, 0, orbitRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.stroke();
        
        const currentOrbitAngle = earthDaysTime * (planet.orbitSpeed * 0.0172);
        const planetX = Math.cos(currentOrbitAngle) * orbitRadius;
        const planetY = Math.sin(currentOrbitAngle) * orbitRadius;
        
        let visualPlanetRadius = Math.max(6, planet.radius * 8.5 * (scale / 30));
        if (planet.radius > 5) visualPlanetRadius = planet.radius * 3.8 * (scale / 30); 
        
        ctx.save();
        ctx.translate(planetX, planetY);
        
        // Вращение текстуры планеты вокруг оси
        const currentSelfRotation = earthDaysTime * (planet.rotateSpeed * 0.05);
        ctx.rotate(currentSelfRotation);
        
        if (images[planet.name]) {
            ctx.drawImage(images[planet.name], -visualPlanetRadius, -visualPlanetRadius, visualPlanetRadius * 2, visualPlanetRadius * 2);
        }
        ctx.restore(); 
        
        // Тень на планете
        ctx.save();
        ctx.translate(planetX, planetY);
        ctx.rotate(currentOrbitAngle); 
        ctx.beginPath();
        ctx.arc(0, 0, visualPlanetRadius + 0.5, -Math.PI / 2, Math.PI / 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)"; 
        ctx.fill();
        ctx.restore();
        
        if (scale > 5) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.font = "12px Arial";
            ctx.fillText(planet.name, planetX + visualPlanetRadius + 5, planetY + 4);
        }

        // Запись координат планеты для ловли наведения мыши
        renderedPlanets.push({
            screenX: planetX + offsetX,
            screenY: planetY + offsetY,
            radius: visualPlanetRadius,
            data: planet
        });
    }); 
    
    ctx.restore(); 
    
    if (!isPaused) {
        earthDaysTime += 1.0 * timeSpeed; 
    }
    
    requestAnimationFrame(animate);
} 

preloadImages(animate);
