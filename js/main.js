// js/main.js

// Toggle mobile navigation (shared across pages that include these IDs)
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuButton && mobileMenu) {
  mobileMenuButton.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
}

// Floating contact widget (shared across pages)
const contactWidgetButton = document.getElementById('contact-widget-button');
const contactWidgetPanel = document.getElementById('contact-widget-panel');
const contactWidgetClose = document.getElementById('contact-widget-close');

if (!document.getElementById('contact-widget-attention-style')) {
  const style = document.createElement('style');
  style.id = 'contact-widget-attention-style';
  style.textContent = `
    @keyframes contactButtonPulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(6, 78, 59, 0.45); }
      65% { transform: scale(1.03); box-shadow: 0 0 0 18px rgba(6, 78, 59, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(6, 78, 59, 0); }
    }
    .contact-widget-attention {
      animation: contactButtonPulse 1.8s ease-out 2;
    }
    @media (prefers-reduced-motion: reduce) {
      .contact-widget-attention { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

if (contactWidgetButton && contactWidgetPanel) {
  contactWidgetButton.classList.add('contact-widget-attention');
  setTimeout(() => {
    contactWidgetButton.classList.remove('contact-widget-attention');
  }, 3800);

  contactWidgetButton.addEventListener('click', () => {
    contactWidgetPanel.classList.toggle('hidden');
  });
}

if (contactWidgetClose && contactWidgetPanel) {
  contactWidgetClose.addEventListener('click', () => {
    contactWidgetPanel.classList.add('hidden');
  });
}

function rebindGallery() {
  const filterButtons = document.querySelectorAll('[data-filter]');
  const galleryItems = document.querySelectorAll('[data-category]');

  if (filterButtons.length && galleryItems.length) {
    filterButtons.forEach((btn) => {
      if (btn.dataset.filterBound === '1') return;
      btn.dataset.filterBound = '1';
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');

        filterButtons.forEach((b) =>
          b.classList.remove('bg-teal-700', 'text-white', 'bg-jungle')
        );
        btn.classList.add('bg-jungle', 'text-white');

        galleryItems.forEach((item) => {
          const category = item.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      });
    });
  }

  // Gallery lightbox (gallery page)
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImage = document.getElementById('gallery-lightbox-image');
  const lightboxClose = document.getElementById('gallery-lightbox-close');
  const lightboxPrev = document.getElementById('gallery-lightbox-prev');
  const lightboxNext = document.getElementById('gallery-lightbox-next');
  const galleryTiles = document.querySelectorAll('.gallery-item');

  if (!(lightbox && lightboxImage && galleryTiles.length)) return;

  const resolveUrl = (value) => {
    const match = (value || '').match(/url\\(['\"]?(.*?)['\"]?\\)/i);
    if (!match || !match[1]) return '';
    try {
      return new URL(match[1], window.location.href).href;
    } catch (err) {
      return match[1];
    }
  };

  const getTileUrl = (tile) => {
    const styleAttr = tile.getAttribute('style') || '';
    const attrMatch = styleAttr.match(/background-image:\\s*url\\((['\"]?)(.*?)\\1\\)/i);
    if (attrMatch && attrMatch[2]) {
      try {
        return new URL(attrMatch[2], window.location.href).href;
      } catch (err) {
        return attrMatch[2];
      }
    }
    const inlineBg = tile.style.backgroundImage || '';
    const computedBg = window.getComputedStyle(tile).backgroundImage || '';
    return resolveUrl(inlineBg) || resolveUrl(computedBg);
  };

  const imageUrls = Array.from(galleryTiles).map((tile) => getTileUrl(tile));
  let currentIndex = 0;

  const openLightbox = (index) => {
    currentIndex = index;
    lightboxImage.src = imageUrls[currentIndex] || '';
    lightboxImage.classList.remove('is-zoomed');
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
  };

  const closeLightbox = () => {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
  };

  const showPrev = () => {
    currentIndex = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
    lightboxImage.src = imageUrls[currentIndex];
    lightboxImage.classList.remove('is-zoomed');
  };

  const showNext = () => {
    currentIndex = (currentIndex + 1) % imageUrls.length;
    lightboxImage.src = imageUrls[currentIndex];
    lightboxImage.classList.remove('is-zoomed');
  };

  galleryTiles.forEach((tile, index) => {
    tile.addEventListener('click', () => openLightbox(index));
  });

  if (lightboxClose && lightboxClose.dataset.bound !== '1') {
    lightboxClose.dataset.bound = '1';
    lightboxClose.addEventListener('click', closeLightbox);
  }
  if (lightboxPrev && lightboxPrev.dataset.bound !== '1') {
    lightboxPrev.dataset.bound = '1';
    lightboxPrev.addEventListener('click', showPrev);
  }
  if (lightboxNext && lightboxNext.dataset.bound !== '1') {
    lightboxNext.dataset.bound = '1';
    lightboxNext.addEventListener('click', showNext);
  }
  if (lightboxImage.dataset.bound !== '1') {
    lightboxImage.dataset.bound = '1';
    lightboxImage.addEventListener('click', () => {
      lightboxImage.classList.toggle('is-zoomed');
    });
  }
  if (lightbox.dataset.bound !== '1') {
    lightbox.dataset.bound = '1';
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  if (!document.body.dataset.galleryKeyBound) {
    document.body.dataset.galleryKeyBound = '1';
    document.addEventListener('keydown', (e) => {
      if (lightbox.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });
  }
}

window.rebindGallery = rebindGallery;
rebindGallery();
if (window.__needsGalleryRebind) {
  rebindGallery();
  window.__needsGalleryRebind = false;
}

// Hero background rotation (index page)
const heroBg = document.getElementById('hero-bg');
if (heroBg) {
  const heroImages = [
    'Nine-Arch-Bridge-Ella-1920x800-1.webp',
    'Nine_Arch_Bridge_in_Ella.jpg',
  ];
  let heroIndex = 0;

  setInterval(() => {
    heroIndex = (heroIndex + 1) % heroImages.length;
    heroBg.style.opacity = '0';
    setTimeout(() => {
      heroBg.style.backgroundImage = `url('${heroImages[heroIndex]}')`;
      heroBg.style.opacity = '1';
    }, 400);
  }, 6000);
}


// Tours map filter (tours page)
const mapPins = document.querySelectorAll('[data-map-location]');
const locationFilters = document.querySelectorAll('[data-location-filter]');
const tourCards = document.querySelectorAll('[data-tour-location]');
const selectedAreaLabel = document.getElementById('map-selected-area');
const districtCardsGrid = document.getElementById('district-cards-grid');

if (tourCards.length && (mapPins.length || locationFilters.length)) {
  const mapRoot = document.getElementById('sri-lanka-map-root');
  let districtPaths = [];
  let districtTitles = [];
  let currentFilter = 'all';
  let activeDistrict = '';
  let districtTooltip = null;
  const toDistrictKey =
    typeof window.normalizeDistrictKey === 'function'
      ? window.normalizeDistrictKey
      : (value) => (value || '').toString().trim().toLowerCase();

  const districtToRegion = {
    anuradhapura: 'cultural-triangle',
    polonnaruwa: 'cultural-triangle',
    matale: 'cultural-triangle',
    mahanuvara: 'cultural-triangle',
    trincomalee: 'cultural-triangle',
    'nuwara-eliya': 'hill-country',
    badulla: 'hill-country',
    ratnapura: 'hill-country',
    galle: 'south-coast',
    matara: 'south-coast',
    hambantota: 'south-coast',
    kalutara: 'south-coast',
    moneragala: 'wildlife',
    ampara: 'wildlife',
    batticaloa: 'wildlife',
  };

  const getRegionForDistrict = (districtName) => {
    const normalizedName = toDistrictKey(districtName);
    return districtToRegion[normalizedName] || 'all';
  };

  const ensureDistrictTooltip = () => {
    if (districtTooltip) return districtTooltip;
    districtTooltip = document.createElement('div');
    districtTooltip.className =
      'pointer-events-none fixed z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg';
    document.body.appendChild(districtTooltip);
    return districtTooltip;
  };

  const showDistrictTooltip = (label, event) => {
    const tooltip = ensureDistrictTooltip();
    tooltip.textContent = label || '';
    tooltip.classList.remove('hidden');
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 12}px`;
  };

  const moveDistrictTooltip = (event) => {
    if (!districtTooltip || districtTooltip.classList.contains('hidden')) return;
    districtTooltip.style.left = `${event.clientX + 12}px`;
    districtTooltip.style.top = `${event.clientY + 12}px`;
  };

  const hideDistrictTooltip = () => {
    if (!districtTooltip) return;
    districtTooltip.classList.add('hidden');
  };

  const paintDistricts = (activeFilter, selectedDistrict) => {
    districtPaths.forEach((path) => {
      const title = path.getAttribute('title') || '';
      const region = getRegionForDistrict(title);
      const normalizedTitle = toDistrictKey(title);
      const inActiveRegion =
        activeFilter !== 'all' && region !== 'all' && region === activeFilter;
      const isSelectedDistrict =
        !!selectedDistrict && normalizedTitle === selectedDistrict;

      path.style.fill = isSelectedDistrict
        ? '#0F766E'
        : inActiveRegion
          ? '#9ebabc'
          : '#cdd9db';
      path.style.opacity = '1';
      path.style.stroke = '#ffffff';
      path.style.strokeWidth = '1.2';
      path.style.transition = 'fill 180ms ease, transform 180ms ease';
      path.style.cursor = 'pointer';
    });
  };

  const titleCase = (value) =>
    (value || '')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const pickEmoji = (guide, region) => {
    const text = `${guide?.climate || ''} ${guide?.focus || ''}`.toLowerCase();
    if (text.includes('cool') || text.includes('mountain') || region === 'hill-country') return '⛰️';
    if (text.includes('coast') || text.includes('beach') || region === 'south-coast') return '🏖️';
    if (text.includes('wildlife') || region === 'wildlife') return '🐘';
    if (text.includes('history') || text.includes('culture') || region === 'cultural-triangle') return '🏛️';
    return '📍';
  };

  const renderDistrictCards = () => {
    if (!districtCardsGrid || !districtTitles.length) return;

    const sortedTitles = [...districtTitles].sort((a, b) => {
      const aNorm = toDistrictKey(a);
      const bNorm = toDistrictKey(b);
      if (aNorm === activeDistrict) return -1;
      if (bNorm === activeDistrict) return 1;
      return a.localeCompare(b);
    });

    districtCardsGrid.innerHTML = sortedTitles
      .map((district) => {
        const normalized = toDistrictKey(district);
        const region = getRegionForDistrict(district);
        const isActive = normalized === activeDistrict;
        const regionLabel = region === 'all' ? 'Unmapped region' : titleCase(region.replace('-', ' '));
        const guide =
          (window.DISTRICT_GUIDES && window.DISTRICT_GUIDES[normalized]) || null;
        const summary = guide?.summary || 'District overview will be added soon.';
        const climate = guide?.climate || 'Climate details coming soon';
        const weather = guide?.weather || 'Weather details coming soon';
        const focus = guide?.focus || 'Travel highlights';
        const icon = pickEmoji(guide, region);
        const readMoreHref = `district-guide.html?district=${encodeURIComponent(normalized)}`;
        return `
          <article
            data-district-card="${normalized}"
            class="rounded-xl border px-3 py-3 text-left transition ${
              isActive
                ? 'border-jungle bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
            }"
          >
            <p class="text-sm font-semibold ${isActive ? 'text-jungle' : 'text-slate-800'}">${district}</p>
            <p class="mt-1 text-xs ${isActive ? 'text-jungleLight' : 'text-slate-500'}">${summary}</p>
            <div class="mt-3 flex flex-wrap gap-1.5 text-[0.65rem]">
              <span class="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200">${icon} ${regionLabel}</span>
              <span class="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200">🌤️ ${climate}</span>
              <span class="rounded-full bg-white px-2 py-1 text-slate-700 ring-1 ring-slate-200">🎯 ${focus}</span>
            </div>
            <p class="mt-2 text-[0.68rem] text-slate-500">🗓️ ${weather}</p>
            <div class="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                data-district-select="${normalized}"
                class="rounded-full bg-jungle px-3 py-1.5 text-[0.68rem] font-semibold text-white hover:bg-jungleLight"
              >
                Show on map
              </button>
              <a
                href="${readMoreHref}"
                class="rounded-full border border-slate-300 px-3 py-1.5 text-[0.68rem] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Read more
              </a>
            </div>
          </article>
        `;
      })
      .join('');

    districtCardsGrid.querySelectorAll('[data-district-select]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const normalizedDistrict = button.getAttribute('data-district-select') || '';
        const districtName = districtTitles.find(
          (item) => toDistrictKey(item) === normalizedDistrict
        ) || '';
        const region = getRegionForDistrict(districtName);
        if (region !== 'all') {
          applyLocationFilter(region, normalizedDistrict);
        } else {
          activeDistrict = normalizedDistrict;
          paintDistricts(currentFilter, activeDistrict);
          renderDistrictCards();
          if (selectedAreaLabel) selectedAreaLabel.textContent = `Selected area: ${districtName}`;
        }
      });
    });

    if (activeDistrict) {
      const activeCard = districtCardsGrid.querySelector(
        `[data-district-card="${activeDistrict}"]`
      );
      if (activeCard instanceof HTMLElement) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  };

  const setActiveFilterButton = (value) => {
    locationFilters.forEach((btn) => {
      const isActive = btn.getAttribute('data-location-filter') === value;
      btn.classList.toggle('bg-jungle', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('bg-slate-100', !isActive);
      btn.classList.toggle('text-slate-700', !isActive);
    });
  };

  const setActivePin = (value) => {
    mapPins.forEach((pin) => {
      const isActive = pin.getAttribute('data-map-location') === value;
      pin.classList.toggle('scale-125', isActive);
      pin.classList.toggle('ring-4', isActive);
      pin.classList.toggle('ring-jungle/40', isActive);
    });
  };

  const applyLocationFilter = (value, selectedDistrictName) => {
    const normalized = value || 'all';
    currentFilter = normalized;
    if (typeof selectedDistrictName === 'string') {
      activeDistrict = selectedDistrictName;
    }

    setActiveFilterButton(normalized);
    setActivePin(normalized);
    paintDistricts(normalized, activeDistrict);
    renderDistrictCards();
    if (selectedAreaLabel) {
      const selectedDistrictName = districtTitles.find(
        (item) => toDistrictKey(item) === activeDistrict
      );
      selectedAreaLabel.textContent = activeDistrict
        ? `Selected area: ${selectedDistrictName || titleCase(activeDistrict.replace('-', ' '))}`
        : 'Selected area: All';
    }

    tourCards.forEach((card) => {
      const locations = (card.getAttribute('data-tour-location') || '')
        .split(/\s+/)
        .filter(Boolean);
      const match = normalized === 'all' || locations.includes(normalized);
      card.classList.toggle('hidden', !match);
    });
  };

  locationFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLocationFilter(btn.getAttribute('data-location-filter') || 'all', '');
    });
  });

  mapPins.forEach((pin) => {
    pin.addEventListener('click', () => {
      applyLocationFilter(pin.getAttribute('data-map-location') || 'all', '');
    });
  });

  if (mapRoot) {
    fetch('images/sri-lanka.svg')
      .then((res) => res.text())
      .then((svgMarkup) => {
        mapRoot.innerHTML = svgMarkup;
        const svg = mapRoot.querySelector('svg');
        if (!svg) return;

        const hasViewBox = svg.hasAttribute('viewBox');
        const rawWidth = parseFloat(svg.getAttribute('width') || '');
        const rawHeight = parseFloat(svg.getAttribute('height') || '');
        if (!hasViewBox && Number.isFinite(rawWidth) && Number.isFinite(rawHeight)) {
          svg.setAttribute('viewBox', `0 0 ${rawWidth} ${rawHeight}`);
        }

        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';

        districtPaths = Array.from(svg.querySelectorAll('path[title]'));
        districtTitles = Array.from(
          new Set(
            districtPaths
              .map((path) => (path.getAttribute('title') || '').trim())
              .filter(Boolean)
          )
        );
        districtPaths.forEach((path) => {
          path.addEventListener('mouseenter', (event) => {
            const title = path.getAttribute('title') || '';
            showDistrictTooltip(title, event);
            if (toDistrictKey(path.getAttribute('title')) === activeDistrict) return;
            path.style.fill = '#b9ced0';
          });
          path.addEventListener('mousemove', (event) => {
            moveDistrictTooltip(event);
          });
          path.addEventListener('mouseleave', () => {
            hideDistrictTooltip();
            paintDistricts(currentFilter, activeDistrict);
          });
          path.addEventListener('click', () => {
            const title = path.getAttribute('title') || '';
            const normalizedDistrict = toDistrictKey(title);
            activeDistrict = normalizedDistrict;
            const region = getRegionForDistrict(title);
            if (region !== 'all') {
              applyLocationFilter(region, normalizedDistrict);
            } else {
              paintDistricts(currentFilter, activeDistrict);
              if (selectedAreaLabel) selectedAreaLabel.textContent = `Selected area: ${title}`;
            }
          });
        });

        paintDistricts(currentFilter, activeDistrict);
        renderDistrictCards();
      })
      .catch(() => {
        mapRoot.textContent = '';
      });
  }

  applyLocationFilter('all', '');
}


// Contact form submit (all pages)
const contactForms = document.querySelectorAll('.contact-form');
if (contactForms.length) {
  contactForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      const formData = new FormData(form);
      formData.append('source', form.getAttribute('data-source') || window.location.pathname);
      const payload = Object.fromEntries(formData.entries());
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        alert('Thanks! Your message has been sent.');
      } catch (err) {
        alert('Sorry, something went wrong. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
}

