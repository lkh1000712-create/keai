/**
 * KEAI 동적 이미지 로더
 * Cloudflare R2에 저장된 이미지를 동적으로 로드
 *
 * 사용법:
 * 1. HTML 요소에 data-image-id 속성 추가
 *    - <img data-image-id="hero-home" alt="히어로 배경">
 *    - <div data-image-id="hero-home" style="background-size: cover;"></div>
 *
 * 2. 페이지 로드 시 자동으로 이미지 URL 적용
 */

(function() {
  'use strict';

  // API 기본 URL
  const API_BASE = window.CONFIG?.API_BASE || '/api';

  // 캐시 유효 시간 (5분)
  const CACHE_TTL = 5 * 60 * 1000;

  // 이미지 캐시
  let imageCache = null;
  let cacheTimestamp = 0;

  /**
   * 모든 동적 이미지 로드
   */
  async function loadDynamicImages() {
    try {
      const images = await fetchImages();
      applyImages(images);
    } catch (error) {
      console.error('[ImageLoader] Failed to load images:', error);
    }
  }

  /**
   * API에서 이미지 목록 가져오기
   */
  async function fetchImages() {
    // 캐시 확인
    const now = Date.now();
    if (imageCache && (now - cacheTimestamp) < CACHE_TTL) {
      return imageCache;
    }

    const response = await fetch(`${API_BASE}/images`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    // 캐시 저장
    imageCache = result.images || [];
    cacheTimestamp = now;

    return imageCache;
  }

  /**
   * 이미지 URL을 DOM 요소에 적용
   */
  function applyImages(images) {
    const imageMap = new Map(images.map(img => [img.id, img.url]));

    // data-image-id 속성을 가진 모든 요소 찾기
    const elements = document.querySelectorAll('[data-image-id]');

    elements.forEach(element => {
      const imageId = element.getAttribute('data-image-id');
      const imageUrl = imageMap.get(imageId);

      if (!imageUrl) {
        console.warn(`[ImageLoader] No image found for id: ${imageId}`);
        return;
      }

      if (element.tagName === 'IMG') {
        // <img> 태그
        element.src = imageUrl;
        element.setAttribute('data-loaded', 'true');
      } else {
        // 배경 이미지 적용 (div 등)
        element.style.backgroundImage = `url(${imageUrl})`;
        element.setAttribute('data-loaded', 'true');
      }
    });
  }

  /**
   * 특정 이미지 ID의 URL 가져오기
   */
  async function getImageUrl(imageId) {
    try {
      const images = await fetchImages();
      const image = images.find(img => img.id === imageId);
      return image?.url || null;
    } catch (error) {
      console.error(`[ImageLoader] Failed to get image ${imageId}:`, error);
      return null;
    }
  }

  /**
   * 캐시 무효화
   */
  function invalidateCache() {
    imageCache = null;
    cacheTimestamp = 0;
  }

  /**
   * 이미지 새로고침
   */
  async function refreshImages() {
    invalidateCache();
    await loadDynamicImages();
  }

  // DOM 로드 시 자동 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDynamicImages);
  } else {
    // 이미 로드된 경우 즉시 실행
    loadDynamicImages();
  }

  // 전역 객체로 노출
  window.ImageLoader = {
    load: loadDynamicImages,
    refresh: refreshImages,
    getUrl: getImageUrl,
    invalidateCache: invalidateCache
  };

})();
