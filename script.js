// script.js — полная логика калькулятора и работа с Telegram Mini App

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Расширяем приложение на весь экран и настраиваем внешний вид
tg.expand();
tg.setHeaderColor('#0a1a2f'); // Цвет под шапку приложения
tg.setBackgroundColor('#f8fafd');

// Основные данные приложения
let calculationResults = null;
let userContact = {
    name: '',
    phone: '',
    email: '',
    comment: ''
};

// Элементы интерфейса
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const progressFill = document.querySelector('.progress-fill');
const steps = document.querySelectorAll('.step');

// Функция переключения шагов
function setStep(stepNumber) {
    // Скрываем все шаги
    step1.classList.remove('active');
    step2.classList.remove('active');
    step3.classList.remove('active');
    
    // Показываем нужный шаг
    if (stepNumber === 1) step1.classList.add('active');
    if (stepNumber === 2) step2.classList.add('active');
    if (stepNumber === 3) step3.classList.add('active');
    
    // Обновляем прогресс-бар
    const progressWidth = stepNumber === 1 ? '33%' : stepNumber === 2 ? '66%' : '100%';
    progressFill.style.width = progressWidth;
    
    // Обновляем активные шаги в прогрессе
    steps.forEach((step, index) => {
        if (index < stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Функция расчёта (логика из предыдущего бота, адаптированная под интерфейс)
function calculateCosts(data) {
    const qty = data.quantity;
    const priceUsd = data.priceUsd;
    const usdRate = data.usdRate;
    const weightKg = data.weight;
    const volumeM3 = data.volume;
    const logisticsRateUsd = data.logisticsRate;
    const dutyRate = data.dutyRate;
    const lastMileRubPerKg = data.lastMile;

    // Инвойс
    const invoiceUsd = priceUsd * qty;
    // Комиссия ТД 10%
    const tdUsd = invoiceUsd * 0.1;
    // Комиссия агента 4% от суммы с ТД
    const agentUsd = (invoiceUsd + tdUsd) * 0.04;

    // Вес и платный вес (берём максимум фактического и объёмного)
    const totalWeightKg = weightKg * qty;
    const totalVolumeM3 = volumeM3 * qty;
    // Коэффициент объёмного веса: для авиа 167, для остальных 250 (усреднённо)
    const volumetricWeight = totalVolumeM3 * 200; // средний коэффициент
    const payableWeight = Math.max(totalWeightKg, volumetricWeight);

    // Логистика
    const logisticsUsd = payableWeight * logisticsRateUsd;

    // Таможенные платежи
    const customsValueRub = (invoiceUsd + logisticsUsd) * usdRate;
    const dutyRub = customsValueRub * (dutyRate / 100);
    const vatRub = (customsValueRub + dutyRub) * 0.20;

    // Последняя миля
    const lastMileRub = totalWeightKg * lastMileRubPerKg;

    // Итого в рублях
    const totalRub = (invoiceUsd + tdUsd + agentUsd + logisticsUsd) * usdRate + dutyRub + vatRub + lastMileRub;
    const costPerItemRub = totalRub / qty;

    return {
        invoiceRub: invoiceUsd * usdRate,
        tdRub: tdUsd * usdRate,
        agentRub: agentUsd * usdRate,
        logisticsRub: logisticsUsd * usdRate,
        dutyRub: dutyRub,
        vatRub: vatRub,
        lastMileRub: lastMileRub,
        totalRub: totalRub,
        costPerItemRub: costPerItemRub,
        productName: data.productName || 'Товар'
    };
}

// Сбор данных из формы калькулятора
function gatherFormData() {
    return {
        productName: document.getElementById('productName').value || 'Товар',
        quantity: parseFloat(document.getElementById('quantity').value) || 0,
        priceUsd: parseFloat(document.getElementById('priceUsd').value) || 0,
        usdRate: parseFloat(document.getElementById('usdRate').value) || 0,
        weight: parseFloat(document.getElementById('weight').value) || 0,
        volume: parseFloat(document.getElementById('volume').value) || 0,
        transport: document.getElementById('transport').value,
        logisticsRate: parseFloat(document.getElementById('logisticsRate').value) || 0,
        dutyRate: parseFloat(document.getElementById('dutyRate').value) || 0,
        lastMile: parseFloat(document.getElementById('lastMile').value) || 0
    };
}

// Отображение результатов
function displayResults(results) {
    document.getElementById('resultProductName').textContent = `Товар: ${results.productName}`;
    document.getElementById('totalRub').textContent = `${Math.round(results.totalRub).toLocaleString()} ₽`;
    document.getElementById('costPerItem').textContent = `${Math.round(results.costPerItemRub).toLocaleString()} ₽ / шт`;
    
    document.getElementById('invoiceRub').textContent = `${Math.round(results.invoiceRub).toLocaleString()} ₽`;
    document.getElementById('tdRub').textContent = `${Math.round(results.tdRub).toLocaleString()} ₽`;
    document.getElementById('agentRub').textContent = `${Math.round(results.agentRub).toLocaleString()} ₽`;
    document.getElementById('logisticsRub').textContent = `${Math.round(results.logisticsRub).toLocaleString()} ₽`;
    document.getElementById('dutyRub').textContent = `${Math.round(results.dutyRub).toLocaleString()} ₽`;
    document.getElementById('vatRub').textContent = `${Math.round(results.vatRub).toLocaleString()} ₽`;
    document.getElementById('lastMileRub').textContent = `${Math.round(results.lastMileRub).toLocaleString()} ₽`;
}

// Отправка данных на сервер (бэкенд для сбора заявок)
async function submitContactForm(contactData, calculationData) {
    // Формируем полные данные заявки
    const fullData = {
        contact: contactData,
        calculation: calculationData,
        telegramData: {
            userId: tg.initDataUnsafe?.user?.id,
            username: tg.initDataUnsafe?.user?.username,
            firstName: tg.initDataUnsafe?.user?.first_name,
            lastName: tg.initDataUnsafe?.user?.last_name,
            languageCode: tg.initDataUnsafe?.user?.language_code
        },
        timestamp: new Date().toISOString()
    };

    try {
        // Отправляем на ваш сервер (замените URL на свой)
        const response = await fetch('https://supply-server-h8sg.onrender.com/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fullData)
        });

        if (response.ok) {
            // Показываем сообщение об успехе
            document.getElementById('contactForm').style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';
            
            // Отправляем событие в Telegram, что приложение выполнило задачу
            tg.sendData(JSON.stringify({ status: 'success' }));
        } else {
            alert('Ошибка при отправке. Пожалуйста, попробуйте ещё раз.');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Ошибка сети. Проверьте подключение.');
    }
}

// --- Обработчики событий ---

// Кнопка "Рассчитать"
document.getElementById('calculateBtn').addEventListener('click', () => {
    const formData = gatherFormData();
    
    // Валидация
    if (formData.quantity <= 0 || formData.priceUsd <= 0 || formData.usdRate <= 0) {
        tg.showAlert('Пожалуйста, заполните все обязательные поля корректно.');
        return;
    }
    
    calculationResults = calculateCosts(formData);
    displayResults(calculationResults);
    setStep(2);
});

// Кнопка "Вернуться к редактированию"
document.getElementById('backToEditBtn').addEventListener('click', () => {
    setStep(1);
});

// Кнопка "Оставить контакты"
document.getElementById('continueToContactBtn').addEventListener('click', () => {
    setStep(3);
});

// Нативный запрос контакта через Telegram
document.getElementById('requestTelegramContactBtn').addEventListener('click', () => {
    tg.requestContact((success, contact) => {
        if (success && contact) {
            // Заполняем поля контактными данными из Telegram
            document.getElementById('contactName').value = `${tg.initDataUnsafe?.user?.first_name || ''} ${tg.initDataUnsafe?.user?.last_name || ''}`.trim();
            if (contact.phone_number) {
                document.getElementById('contactPhone').value = contact.phone_number;
            }
            tg.showAlert('Контакт получен! Пожалуйста, проверьте и дополните данные.');
        } else {
            tg.showAlert('Не удалось получить контакт. Вы можете ввести данные вручную.');
        }
    });
});

// Отправка контактной формы
document.getElementById('contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Собираем контактные данные
    userContact = {
        name: document.getElementById('contactName').value,
        phone: document.getElementById('contactPhone').value,
        email: document.getElementById('contactEmail').value,
        comment: document.getElementById('contactComment').value
    };
    
    // Проверка обязательных полей
    if (!userContact.name || !userContact.phone || !userContact.email) {
        tg.showAlert('Пожалуйста, заполните имя, телефон и email.');
        return;
    }
    
    // Отправляем на сервер
    submitContactForm(userContact, calculationResults);
});

// Обработка кнопки "Назад" в Telegram (MainButton)
tg.onEvent('backButtonClicked', () => {
    if (step3.classList.contains('active')) {
        setStep(2);
    } else if (step2.classList.contains('active')) {
        setStep(1);
    } else {
        tg.close();
    }
});

// Показываем кнопку "Назад" на втором и третьем шаге
tg.BackButton.show();

// Инициализация: показываем первый шаг
setStep(1);

// Уведомляем Telegram, что приложение готово
tg.ready();