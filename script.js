// ================= GLOBAL VARIABLES =================
let currentCarIndex = 0;
let cars = [];
let isAnimating = false;

// ================= DOM ELEMENTS =================
const DOM = {
  // Loader
  loader: document.querySelector('.loader'),
  
  // Mobile Navigation
  menuToggle: document.getElementById('menuToggle'),
  navMobile: document.getElementById('navMobile'),
  closeMenu: document.getElementById('closeMenu'),
  
  // Car Slider
  carSliderTrack: document.getElementById('carSliderTrack'),
  sliderIndicators: document.getElementById('sliderIndicators'),
  prevCar: document.getElementById('prevCar'),
  nextCar: document.getElementById('nextCar'),
  currentCarName: document.getElementById('currentCarName'),
  currentCarDescription: document.getElementById('currentCarDescription'),
  currentCarPrice: document.getElementById('currentCarPrice'),
  carDetailsPanel: document.getElementById('carDetailsPanel'),
  closeDetails: document.getElementById('closeDetails'),
  
  // Modal
  bookingModal: document.getElementById('bookingModal'),
  closeModal: document.getElementById('closeModal'),
  openBookingModalBtns: document.querySelectorAll('.open-booking-modal'),
  
  // Stats
  statNumbers: document.querySelectorAll('.stat-number'),
  
  // Forms
  bookingForm: document.querySelector('.booking-form'),
  subscribeForm: document.querySelector('.subscribe-form'),
  
  // Navigation Links
  navLinks: document.querySelectorAll('.nav-link, .mobile-nav-link'),
  sections: document.querySelectorAll('section')
};

// ================= CARS DATA =================
cars = [
  {
    id: 1,
    name: "Porsche 911 Turbo S",
    category: "Спорткар",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    price: "10 000",
    description: "Флагманский спорткар с технологиями Formula 1. 650 л.с., разгон до 100 км/ч за 2.7 секунды. Идеален для горных дорог Абхазии.",
    specs: {
      power: "650 л.с.",
      acceleration: "2.7 сек",
      transmission: "Автомат",
      drive: "Полный",
      seats: "2",
      year: "2026"
    },
    features: ["Premium салон", "Apple CarPlay", "Кожаные сиденья", "Парктроник 360°"]
  },
  {
    id: 2,
    name: "Mercedes G63 AMG",
    category: "Внедорожник",
    image: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    price: "10 000",
    description: "Легендарный внедорожник с характером. 585 л.с., система полного привода 4MATIC. Комфорт и проходимость в любых условиях.",
    specs: {
      power: "585 л.с.",
      acceleration: "4.5 сек",
      transmission: "Автомат",
      drive: "Полный",
      seats: "5",
      year: "2022"
    },
    features: ["Панорамная крыша", "Массаж сидений", "Burmester аудио", "Круиз-контроль"]
  },
  {
    id: 3,
    name: "BMW M8 Competition",
    category: "Гранд турер",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    price: "20 000",
    description: "Мощный гранд турер для длительных путешествий. 625 л.с., интеллектуальный полный привод. Идеальный баланс комфорта и динамики.",
    specs: {
      power: "625 л.с.",
      acceleration: "3.2 сек",
      transmission: "Автомат",
      drive: "Полный",
      seats: "4",
      year: "2026"
    },
    features: ["Цифровая приборка", "Хэд-ап дисплей", "Вентиляция сидений", "Спорт режим"]
  },
  {
    id: 4,
    name: "Range Rover Autobiography",
    category: "Люкс внедорожник",
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    price: "15 000",
    description: "Вершина британского автомобилестроения. Изысканный интерьер, адаптивная подвеска и исключительный комфорт.",
    specs: {
      power: "530 л.с.",
      acceleration: "5.4 сек",
      transmission: "Автомат",
      drive: "Полный",
      seats: "5",
      year: "2022"
    },
    features: ["Кожа Meridian", "Климат контроль", "Пневмоподвеска", "Проекционный дисплей"]
  },
  {
    id: 5,
    name: "Audi RS6 Avant",
    category: "Универсал",
    image: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    price: "26 000",
    description: "Самый быстрый семейный автомобиль. 600 л.с., просторный багажник. Динамика спорткара с практичностью универсала.",
    specs: {
      power: "600 л.с.",
      acceleration: "3.6 сек",
      transmission: "Автомат",
      drive: "Полный",
      seats: "5",
      year: "2026"
    },
    features: ["Matrix LED", "Виртуальная приборка", "Массаж сидений", "Память настроек"]
  },
  {
    id: 6,
    name: "Lexus LX 600",
    category: "Премиум внедорожник",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    price: "10 000",
    description: "Японская надежность и роскошь. Многоместный салон, высочайший уровень оснащения. Для самых требовательных путешественников.",
    specs: {
      power: "409 л.с.",
      acceleration: "6.9 сек",
      transmission: "Автомат",
      drive: "Полный",
      seats: "7",
      year: "2026"
    },
    features: ["4-зонный климат", "Холодильник", "Развлекательная система", "Камера 360°"]
  }
];

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Hide loader after 1.5 seconds
  setTimeout(() => {
    DOM.loader.classList.add('loaded');
    document.body.style.overflow = 'auto';
  }, 1500);

  // Initialize all components
  initMobileNavigation();
  initCarSlider();
  initStatsCounter();
  initModal();
  initForms();
  initSmoothScroll();
  initActiveNavigation();
}

// ================= MOBILE NAVIGATION =================
function initMobileNavigation() {
  if (!DOM.menuToggle || !DOM.navMobile || !DOM.closeMenu) return;

  DOM.menuToggle.addEventListener('click', () => {
    DOM.menuToggle.classList.toggle('active');
    DOM.navMobile.classList.toggle('active');
    document.body.style.overflow = DOM.navMobile.classList.contains('active') ? 'hidden' : 'auto';
  });

  DOM.closeMenu.addEventListener('click', () => {
    DOM.menuToggle.classList.remove('active');
    DOM.navMobile.classList.remove('active');
    document.body.style.overflow = 'auto';
  });

  // Close mobile menu when clicking on links
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      DOM.menuToggle.classList.remove('active');
      DOM.navMobile.classList.remove('active');
      document.body.style.overflow = 'auto';
    });
  });
}

// ================= CAR SLIDER =================
function initCarSlider() {
  if (!cars.length) return;

  // Render cars
  renderCars();
  renderIndicators();
  
  // Set initial car details
  updateCarDetails(0);

  // Event listeners
  DOM.prevCar.addEventListener('click', () => navigateCar(-1));
  DOM.nextCar.addEventListener('click', () => navigateCar(1));
  DOM.closeDetails.addEventListener('click', () => DOM.carDetailsPanel.classList.remove('active'));

  // View details buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-view-details') || 
        e.target.closest('.btn-view-details')) {
      const carId = parseInt(e.target.closest('.car-slide').dataset.id);
      const carIndex = cars.findIndex(car => car.id === carId);
      currentCarIndex = carIndex;
      updateCarDetails(carIndex);
      DOM.carDetailsPanel.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') navigateCar(-1);
    if (e.key === 'ArrowRight') navigateCar(1);
    if (e.key === 'Escape') {
      DOM.carDetailsPanel.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });
}

function renderCars() {
  DOM.carSliderTrack.innerHTML = '';
  
  cars.forEach(car => {
    const carSlide = document.createElement('div');
    carSlide.className = 'car-slide fade-in';
    carSlide.dataset.id = car.id;
    
    carSlide.innerHTML = `
      <div class="car-image-container">
        <img src="${car.image}" alt="${car.name}" class="car-image">
        <div class="car-overlay"></div>
      </div>
      <div class="car-info">
        <div class="car-category">${car.category}</div>
        <h3 class="car-name">${car.name}</h3>
        <div class="car-specs">
          <div class="car-spec">
            <i class="fas fa-tachometer-alt"></i>
            <span>${car.specs.power}</span>
          </div>
          <div class="car-spec">
            <i class="fas fa-cogs"></i>
            <span>${car.specs.transmission}</span>
          </div>
          <div class="car-spec">
            <i class="fas fa-user-friends"></i>
            <span>${car.specs.seats} места</span>
          </div>
        </div>
        <div class="car-price">
          <div class="price-tag">
            <span class="price-amount">${car.price} ₽</span>
            <span class="price-period">/ сутки</span>
          </div>
          // Вместо кнопки "Подробнее" заменить на:
<button class="btn btn-secondary view-car-details" data-url="${car.url}">
    Подробнее
</button>
        </div>
      </div>
    `;
    
    DOM.carSliderTrack.appendChild(carSlide);
  });
}

function renderIndicators() {
  DOM.sliderIndicators.innerHTML = '';
  
  cars.forEach((_, index) => {
    const indicator = document.createElement('button');
    indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
    indicator.addEventListener('click', () => {
      if (isAnimating) return;
      currentCarIndex = index;
      updateCarDetails(index);
      updateIndicators();
      scrollToCar(index);
    });
    DOM.sliderIndicators.appendChild(indicator);
  });
}

function navigateCar(direction) {
  if (isAnimating) return;
  
  const newIndex = (currentCarIndex + direction + cars.length) % cars.length;
  currentCarIndex = newIndex;
  
  updateCarDetails(newIndex);
  updateIndicators();
  scrollToCar(newIndex);
}

function scrollToCar(index) {
  if (!DOM.carSliderTrack) return;
  
  isAnimating = true;
  const carSlide = DOM.carSliderTrack.children[index];
  const slideWidth = carSlide.offsetWidth;
  const gap = 40;
  
  DOM.carSliderTrack.scrollTo({
    left: index * (slideWidth + gap),
    behavior: 'smooth'
  });
  
  setTimeout(() => {
    isAnimating = false;
  }, 500);
}

function updateCarDetails(index) {
  const car = cars[index];
  
  DOM.currentCarName.textContent = car.name;
  DOM.currentCarDescription.textContent = car.description;
  DOM.currentCarPrice.textContent = `${car.price} ₽`;
  
  // Update car specs in details panel
  const specsGrid = document.querySelector('.car-specs-grid');
  if (specsGrid) {
    specsGrid.innerHTML = `
      <div class="spec-item">
        <div class="spec-icon">🚀</div>
        <div class="spec-value">${car.specs.power}</div>
        <div class="spec-label">Мощность</div>
      </div>
      <div class="spec-item">
        <div class="spec-icon">⏱️</div>
        <div class="spec-value">${car.specs.acceleration}</div>
        <div class="spec-label">0-100 км/ч</div>
      </div>
      <div class="spec-item">
        <div class="spec-icon">🛋️</div>
        <div class="spec-value">${car.specs.seats} места</div>
        <div class="spec-label">Вместимость</div>
      </div>
      <div class="spec-item">
        <div class="spec-icon">📱</div>
        <div class="spec-value">${car.specs.year} г.в.</div>
        <div class="spec-label">Год выпуска</div>
      </div>
    `;
  }
}

function updateIndicators() {
  const indicators = DOM.sliderIndicators.querySelectorAll('.indicator');
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('active', index === currentCarIndex);
  });
}

// ================= STATS COUNTER =================
function initStatsCounter() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        DOM.statNumbers.forEach(stat => {
          animateCounter(stat);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const statsSection = document.querySelector('.stats');
  if (statsSection) observer.observe(statsSection);
}

function animateCounter(element) {
  const target = parseInt(element.dataset.target);
  const duration = 2000;
  const step = target / (duration / 16); // 60fps
  
  let current = 0;
  
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current);
  }, 16);
}

// ================= MODAL =================
function initModal() {
  // Open modal
  DOM.openBookingModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.bookingModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  // Close modal
  DOM.closeModal.addEventListener('click', () => {
    DOM.bookingModal.classList.remove('active');
    document.body.style.overflow = 'auto';
  });

  // Close modal when clicking outside
  DOM.bookingModal.addEventListener('click', (e) => {
    if (e.target === DOM.bookingModal || e.target.classList.contains('modal-overlay')) {
      DOM.bookingModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.bookingModal.classList.contains('active')) {
      DOM.bookingModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });
}

// ================= FORMS =================
function initForms() {
  // Booking form
  if (DOM.bookingForm) {
    DOM.bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Get form data
      const formData = new FormData(DOM.bookingForm);
      const data = Object.fromEntries(formData);
      
      // In a real app, you would send this data to a server
      console.log('Booking submitted:', data);
      
      // Show success message
      alert('Заявка успешно отправлена! Наш менеджер свяжется с вами в течение 15 минут.');
      
      // Close modal and reset form
      DOM.bookingModal.classList.remove('active');
      document.body.style.overflow = 'auto';
      DOM.bookingForm.reset();
    });
  }

  // Subscribe form
  if (DOM.subscribeForm) {
    DOM.subscribeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const email = DOM.subscribeForm.querySelector('.subscribe-input').value;
      
      // Simple email validation
      if (!validateEmail(email)) {
        alert('Пожалуйста, введите корректный email адрес.');
        return;
      }
      
      // In a real app, you would send this data to a server
      console.log('Subscription submitted:', email);
      
      // Show success message
      alert('Спасибо за подписку! Теперь вы будете получать наши новости и специальные предложения.');
      
      // Reset form
      DOM.subscribeForm.reset();
    });
  }
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ================= SMOOTH SCROLL =================
function initSmoothScroll() {
  // Add smooth scroll to all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      
      // Skip if it's just "#"
      if (href === '#') return;
      
      e.preventDefault();
      
      const targetElement = document.querySelector(href);
      if (targetElement) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const targetPosition = targetElement.offsetTop - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ================= ACTIVE NAVIGATION =================
function initActiveNavigation() {
  // Update active navigation link on scroll
  window.addEventListener('scroll', () => {
    let current = '';
    
    DOM.sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      const headerHeight = document.querySelector('.header').offsetHeight;
      
      if (scrollY >= (sectionTop - headerHeight - 100)) {
        current = section.getAttribute('id');
      }
    });
    
    DOM.navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

// ================= OBSERVER FOR ANIMATIONS =================
// Add fade-in animations when elements come into view
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
  const elementsToAnimate = document.querySelectorAll(
    '.why-card, .process-step, .review-card, .stat-card'
  );
  
  elementsToAnimate.forEach(element => {
    observer.observe(element);
  });
});

// ================= UTILITY FUNCTIONS =================
// Format phone number
function formatPhoneNumber(phone) {
  return phone.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 ($2) $3-$4-$5');
}

// Debounce function for performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for scroll events
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ================= WINDOW RESIZE HANDLER =================
window.addEventListener('resize', debounce(() => {
  // Update car slider on resize
  if (DOM.carSliderTrack) {
    scrollToCar(currentCarIndex);
  }
}, 250));