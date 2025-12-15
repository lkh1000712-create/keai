/**
 * KEAI 한국기업심사원 - Main JavaScript
 * Corporate Blue Theme
 */

(function() {
    'use strict';

    // ================================================
    // MOBILE MENU
    // ================================================
    window.toggleMobileMenu = function() {
        const menu = document.getElementById('keaiMobileMenu');
        const overlay = document.getElementById('keaiMobileOverlay');
        if (menu && overlay) {
            menu.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
        }
    };

    // ================================================
    // NAVIGATION ACTIVE STATE
    // ================================================
    function setActiveNav() {
        const currentPath = window.location.pathname;
        const pageMap = {
            '/': 'home',
            '/index.html': 'home',
            '/company.html': 'company',
            '/process.html': 'process',
            '/fund.html': 'fund',
            '/pro.html': 'pro',
            '/mkt.html': 'mkt'
        };

        const activePage = pageMap[currentPath] || 'home';

        // Desktop navigation
        const navLink = document.getElementById('nav-' + activePage);
        if (navLink) {
            navLink.classList.add('active');
        }

        // Mobile navigation
        const mobileNavLink = document.getElementById('mobile-nav-' + activePage);
        if (mobileNavLink) {
            mobileNavLink.classList.add('active');
        }
    }

    // ================================================
    // HERO SLIDER (Mobile)
    // ================================================
    function initHeroSlider() {
        const section = document.querySelector('.keai-hero');
        if (!section) return false;

        const track = section.querySelector('.keai-features-track');
        const cards = section.querySelectorAll('.keai-feature-card');
        const prevBtn = section.querySelector('.keai-slider-prev');
        const nextBtn = section.querySelector('.keai-slider-next');
        const dots = section.querySelectorAll('.keai-slider-dot');

        if (!track || cards.length === 0) return false;

        let currentIndex = 0;
        const totalSlides = cards.length;

        function updateSlider() {
            const offset = -currentIndex * 100;
            track.style.transform = `translateX(${offset}%)`;

            dots.forEach((dot, index) => {
                if (index === currentIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }

        function goToSlide(index) {
            if (index < 0) {
                currentIndex = totalSlides - 1;
            } else if (index >= totalSlides) {
                currentIndex = 0;
            } else {
                currentIndex = index;
            }
            updateSlider();
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                goToSlide(currentIndex - 1);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                goToSlide(currentIndex + 1);
            });
        }

        dots.forEach((dot, index) => {
            dot.addEventListener('click', function() {
                goToSlide(index);
            });
        });

        // Touch swipe support
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        track.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    goToSlide(currentIndex + 1);
                } else {
                    goToSlide(currentIndex - 1);
                }
            }
        }

        console.log('[KEAI] Hero slider initialized');
        return true;
    }

    // ================================================
    // SCROLL ANIMATIONS
    // ================================================
    function initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                }
            });
        }, observerOptions);

        // Target elements
        const elements = document.querySelectorAll(
            '.keai-hero-headline, .keai-feature-card, .keai-notice-box, ' +
            '.keai-step-card, .keai-mobile-step-card, .keai-service-card'
        );

        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = `opacity 0.6s ease ${index * 0.05}s, transform 0.6s ease ${index * 0.05}s`;
            observer.observe(el);
        });

        // Add animated styles
        const style = document.createElement('style');
        style.textContent = `
            .animated {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        `;
        document.head.appendChild(style);

        console.log('[KEAI] Scroll animations initialized');
    }

    // ================================================
    // SWIPER INITIALIZATION (Process & Service Sections)
    // ================================================
    let processSwiperInstance = null;
    let serviceSwiperInstance = null;

    function initProcessSwiper() {
        if (typeof Swiper === 'undefined') return;
        if (window.innerWidth >= 768) return;
        if (processSwiperInstance) return;

        const swiperEl = document.querySelector('.keai-process .mobile-swiper');
        if (!swiperEl) return;

        processSwiperInstance = new Swiper(swiperEl, {
            slidesPerView: 1,
            spaceBetween: 0,
            centeredSlides: false,
            loop: false,
            grabCursor: true,
            watchOverflow: true,
            navigation: {
                nextEl: '.keai-process .swiper-button-next',
                prevEl: '.keai-process .swiper-button-prev',
            },
            pagination: {
                el: '.keai-process .swiper-pagination',
                clickable: true,
            }
        });

        console.log('[KEAI] Process Swiper initialized');
    }

    function initServiceSwiper() {
        if (typeof Swiper === 'undefined') return;
        if (window.innerWidth >= 768) return;
        if (serviceSwiperInstance) return;

        const swiperEl = document.querySelector('.keai-service .mobile-swiper');
        if (!swiperEl) return;

        serviceSwiperInstance = new Swiper(swiperEl, {
            slidesPerView: 1,
            spaceBetween: 0,
            centeredSlides: false,
            loop: false,
            grabCursor: true,
            watchOverflow: true,
            navigation: {
                nextEl: '.keai-service .swiper-button-next',
                prevEl: '.keai-service .swiper-button-prev',
            },
            pagination: {
                el: '.keai-service .swiper-pagination',
                clickable: true,
            }
        });

        console.log('[KEAI] Service Swiper initialized');
    }

    function handleResize() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (window.innerWidth >= 768) {
                    if (processSwiperInstance) {
                        processSwiperInstance.destroy(true, true);
                        processSwiperInstance = null;
                    }
                    if (serviceSwiperInstance) {
                        serviceSwiperInstance.destroy(true, true);
                        serviceSwiperInstance = null;
                    }
                } else {
                    initProcessSwiper();
                    initServiceSwiper();
                }
            }, 250);
        });
    }

    // ================================================
    // FORM HANDLING
    // ================================================

    // Cloudflare Workers URL (KEAI용으로 변경 필요)
    const WORKER_URL = 'https://keai.lkh1000712.workers.dev/';

    // Airtable 설정 - KEAI (토큰은 Worker 환경변수에서 관리)
    const AIRTABLE_CONFIG = {
        baseId: 'appxVw5QQ0g4JEjoR',
        tableName: '한국기업심사원'
    };

    // 브랜드 정보 - KEAI
    const BRAND_INFO = {
        name: '한국기업심사원',
        ceo: '이강희',
        phone: '1688-8401',
        email: 'ceo@k-eai.kr',
        address: '인천광역시 서구 중봉대로 612번길 10-20, 505-J302호(청라동, 청라프라자)',
        bizno: '794-35-01595',
        hours: '평일 09:00-18:00',
        logo: 'https://keai-three.vercel.app/logo.png'
    };

    window.handleSubmit = async function(event) {
        event.preventDefault();

        const form = event.target;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const fundTypes = document.querySelectorAll('input[name="fundType"]:checked');
        if (fundTypes.length === 0) {
            alert('지원받고 싶은 자금 종류를 하나 이상 선택해주세요.');
            return;
        }

        const submitButton = document.getElementById('submitButton');
        const successMessage = document.getElementById('successMessage');
        const errorMessage = document.getElementById('errorMessage');

        submitButton.disabled = true;
        submitButton.textContent = '처리 중...';
        successMessage.classList.remove('active');
        errorMessage.classList.remove('active');

        const customerName = form.name.value;
        const customerEmail = form.email.value;
        const customerPhone = form.phone.value;
        const companyName = form.company.value;
        const fundTypesArray = Array.from(fundTypes).map(cb => cb.value);
        const fundTypesList = fundTypesArray.join(', ');

        const airtableFields = {
            '기업명': companyName,
            '사업자번호': form.bizno.value,
            '대표자명': customerName,
            '연락처': customerPhone,
            '이메일': customerEmail,
            '업종': form.industry.value || '-',
            '설립연도': form.founded.value || '-',
            '통화가능시간': form.consultTime.value,
            '필요자금규모': form.amount.value || '-',
            '자금종류': fundTypesArray,
            '문의사항': form.message.value || '',
            '개인정보동의': form.privacy.checked
        };

        const customerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Pretendard', -apple-system, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: #0F4C81; padding: 20px; text-align: center;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">자금 심사 신청이 접수되었습니다</h2>
        </div>
        <div style="padding: 30px;">
            <p>${customerName} 대표님, 안녕하세요.<br>${BRAND_INFO.name}입니다.</p>
            <p>자금 심사 신청이 정상적으로 접수되었습니다.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0F4C81;">
                <h3 style="margin-top: 0; color: #0F4C81; font-size: 16px;">신청 정보</h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr><td style="padding: 5px 0; color: #666;">기업명</td><td style="padding: 5px 0; font-weight: 600;">${companyName}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">대표자</td><td style="padding: 5px 0; font-weight: 600;">${customerName}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">연락처</td><td style="padding: 5px 0; font-weight: 600;">${customerPhone}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">필요 자금</td><td style="padding: 5px 0; font-weight: 600;">${form.amount.value || '미입력'}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">자금 종류</td><td style="padding: 5px 0; font-weight: 600;">${fundTypesList}</td></tr>
                </table>
            </div>
            <p style="background: #e8f4fd; padding: 15px; border-radius: 8px; text-align: center; color: #0F4C81; font-weight: 600;">담당 전문가가 24시간 내 연락드리겠습니다.</p>
        </div>
        <div style="background: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eee;">
            <div style="text-align: center;">
                <img src="${BRAND_INFO.logo}" alt="${BRAND_INFO.name}" style="height: 35px; margin-bottom: 20px;">
            </div>
            <div style="background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <table style="width: 100%; font-size: 13px; color: #555;">
                    <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><span style="color: #999;">대표</span></td><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 500;">${BRAND_INFO.ceo}</td></tr>
                    <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><span style="color: #999;">대표전화</span></td><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 500;">${BRAND_INFO.phone}</td></tr>
                    <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><span style="color: #999;">이메일</span></td><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 500;">${BRAND_INFO.email}</td></tr>
                    <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><span style="color: #999;">주소</span></td><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 500; line-height: 1.5;">인천광역시 서구 중봉대로 612번길 10-20<br><span style="color: #888;">505-J302호 (청라동, 청라프라자)</span></td></tr>
                    <tr><td style="padding: 8px 0;"><span style="color: #999;">사업자번호</span></td><td style="padding: 8px 0; text-align: right; font-weight: 500;">${BRAND_INFO.bizno}</td></tr>
                </table>
            </div>
            <p style="text-align: center; margin-top: 15px; font-size: 12px; color: #999;">상담시간: ${BRAND_INFO.hours}</p>
        </div>
    </div>
</body>
</html>`;

        const staffHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Pretendard', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0F4C81; border-bottom: 3px solid #0F4C81; padding-bottom: 10px;">
            🔔 새로운 심사 신청
        </h2>

        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">📋 기업 정보</h3>
            <p><strong>기업명:</strong> ${companyName}</p>
            <p><strong>사업자번호:</strong> ${form.bizno.value}</p>
            <p><strong>업종:</strong> ${form.industry.value || '-'}</p>
            <p><strong>설립연도:</strong> ${form.founded.value || '-'}</p>
        </div>

        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">👤 담당자 정보</h3>
            <p><strong>대표자명:</strong> ${customerName}</p>
            <p><strong>연락처:</strong> ${customerPhone}</p>
            <p><strong>이메일:</strong> ${customerEmail}</p>
            <p><strong>통화가능시간:</strong> ${form.consultTime.value}</p>
        </div>

        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">💰 자금 정보</h3>
            <p><strong>필요 자금 규모:</strong> ${form.amount.value || '-'}</p>
            <p><strong>자금 종류:</strong> ${fundTypesList}</p>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0F4C81;">
            <h3 style="margin-top: 0;">📝 문의 내용</h3>
            <p style="white-space: pre-wrap;">${form.message.value || '(문의사항 없음)'}</p>
        </div>

        <p style="color: #666; font-size: 14px;">
            신청일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </p>
    </div>
</body>
</html>`;

        const payload = {
            // 토큰은 Worker 환경변수에서 사용 (보안)
            airtableBaseId: AIRTABLE_CONFIG.baseId,
            tableName: AIRTABLE_CONFIG.tableName,
            airtableFields: airtableFields,

            emailFrom: `${BRAND_INFO.name} <noreply@policy-fund.online>`,

            customerEmail: customerEmail,
            customerSubject: `[${BRAND_INFO.name}] 자금 심사 신청이 접수되었습니다`,
            customerHtml: customerHtml,

            staffEmail: BRAND_INFO.email,
            staffBcc: 'mkt@polarad.co.kr',
            staffSubject: `[${BRAND_INFO.name}] 새로운 심사 신청 - ${companyName} (${customerName})`,
            staffHtml: staffHtml
        };

        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                successMessage.classList.add('active');
                submitButton.textContent = '무료 심사 신청하기';
                form.reset();

                setTimeout(() => {
                    successMessage.classList.remove('active');
                    submitButton.disabled = false;
                }, 5000);
            } else {
                throw new Error(result.error || '알 수 없는 오류');
            }

        } catch (error) {
            console.error('Error:', error);
            errorMessage.classList.add('active');
            submitButton.disabled = false;
            submitButton.textContent = '무료 심사 신청하기';

            setTimeout(() => {
                errorMessage.classList.remove('active');
            }, 5000);
        }
    };

    // Toggle privacy detail
    window.togglePrivacyDetail = function() {
        const content = document.getElementById('privacyContent');
        content.classList.toggle('show');
    };

    // ================================================
    // LEGAL MODALS (이용약관, 개인정보처리방침)
    // ================================================
    window.openModal = function(type) {
        const modalId = type === 'terms' ? 'termsModal' : 'privacyModal';
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = function(type, event) {
        if (event && event.target !== event.currentTarget) return;
        const modalId = type === 'terms' ? 'termsModal' : 'privacyModal';
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.keai-modal-overlay.active');
            modals.forEach(modal => {
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    });

    // Auto-format business registration number
    function initBiznoFormatter() {
        const biznoInput = document.querySelector('input[name="bizno"]');
        if (biznoInput) {
            biznoInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length > 3 && value.length <= 5) {
                    value = value.slice(0, 3) + '-' + value.slice(3);
                } else if (value.length > 5) {
                    value = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5, 10);
                }
                e.target.value = value;
            });
        }
    }

    // Auto-format phone number
    function initPhoneFormatter() {
        const phoneInput = document.querySelector('input[name="phone"]');
        if (phoneInput) {
            phoneInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length > 3 && value.length <= 7) {
                    value = value.slice(0, 3) + '-' + value.slice(3);
                } else if (value.length > 7) {
                    value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
                }
                e.target.value = value;
            });
        }
    }

    // Mobile input scroll
    function initMobileInputScroll() {
        if (window.innerWidth <= 768) {
            const inputs = document.querySelectorAll('.keai-form-control');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    setTimeout(() => {
                        this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                });
            });
        }
    }

    // ================================================
    // SMOOTH SCROLL
    // ================================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#' || href === '#form') {
                    e.preventDefault();
                    const target = document.querySelector(href === '#' ? 'body' : href);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    }

    // ================================================
    // INITIALIZATION
    // ================================================
    function init() {
        setActiveNav();
        initHeroSlider();
        initScrollAnimations();
        initProcessSwiper();
        initServiceSwiper();
        handleResize();
        initBiznoFormatter();
        initPhoneFormatter();
        initMobileInputScroll();
        initSmoothScroll();

        console.log('[KEAI] Main.js initialized');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Fallback initialization
    setTimeout(init, 100);
    setTimeout(init, 500);

})();
