/* ==========================================================================
   UE-MENU.JS  Self-contained Uber Eats-style menu logic
   No jQuery. No external deps.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- Helpers ---- */
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const money = (cents) => {
    const amt = (cents / 100).toFixed(2);
    return '$' + amt;
  };

  /* ---- State ---- */
  let cart = { items: [], item_count: 0, total_price: 0 };
  let modalProduct = null;
  let modalSelectedVariant = null;
  let modalQty = 1;

  /* ======================================================================
     AJAX CART
     ====================================================================== */
  const CartAPI = {
    async fetch() {
      try {
        const r = await fetch('/cart.js', { credentials: 'same-origin' });
        cart = await r.json();
        return cart;
      } catch (e) { console.error('Cart fetch error', e); }
    },

    async add(variantId, qty = 1) {
      try {
        const r = await fetch('/cart/add.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity: qty })
        });
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.description || err.message || 'Could not add item');
        }
        await this.fetch();
        return cart;
      } catch (e) {
        Toast.show(e.message || 'Error adding to cart');
        throw e;
      }
    },

    async change(lineKey, qty) {
      try {
        const r = await fetch('/cart/change.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lineKey, quantity: qty })
        });
        if (!r.ok) throw new Error('Cart update failed');
        await this.fetch();
        return cart;
      } catch (e) {
        Toast.show(e.message);
        throw e;
      }
    }
  };

  /* ======================================================================
     TOAST
     ====================================================================== */
  const Toast = {
    el: null,
    timer: null,
    init() { this.el = $('#ue-toast'); },
    show(msg, ms = 2500) {
      if (!this.el) return;
      clearTimeout(this.timer);
      this.el.textContent = msg;
      this.el.classList.add('is-visible');
      this.timer = setTimeout(() => this.el.classList.remove('is-visible'), ms);
    }
  };

  /* ======================================================================
     RENDER CART UI
     ====================================================================== */
  function renderCart() {
    ['sidebar', 'drawer'].forEach(ctx => {
      const itemsEl = $(`#ue-cart-items-${ctx}`);
      const emptyEl = $(`#ue-cart-empty-${ctx}`);
      const footerEl = $(`#ue-cart-footer-${ctx}`);
      const subtotalEl = $(`#ue-cart-subtotal-${ctx}`);

      if (!itemsEl) return;

      if (cart.item_count === 0) {
        itemsEl.innerHTML = '';
        itemsEl.classList.remove('has-items');
        if (emptyEl) emptyEl.style.display = '';
        if (footerEl) footerEl.classList.remove('has-items');
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      itemsEl.classList.add('has-items');
      if (footerEl) footerEl.classList.add('has-items');
      if (subtotalEl) subtotalEl.textContent = money(cart.total_price);

      let html = '';
      cart.items.forEach(item => {
        const imgSrc = item.image
          ? item.image.replace(/(\.\w+)(\?|$)/, '_120x120$1$2')
          : '';
        const variantTitle = item.variant_title && item.variant_title !== 'Default Title'
          ? item.variant_title : '';
        html += `
          <div class="ue-cart-line" data-line-key="${item.key}">
            ${imgSrc ? `<img class="ue-cart-line__img" src="${imgSrc}" alt="" width="56" height="56" loading="lazy">` : ''}
            <div class="ue-cart-line__info">
              <div class="ue-cart-line__title">${item.product_title}</div>
              ${variantTitle ? `<div class="ue-cart-line__variant">${variantTitle}</div>` : ''}
              <div class="ue-cart-line__actions">
                <button class="ue-cart-line__qty-btn" data-action="cart-minus" data-key="${item.key}" data-qty="${item.quantity}" aria-label="Decrease">&minus;</button>
                <span class="ue-cart-line__qty">${item.quantity}</span>
                <button class="ue-cart-line__qty-btn" data-action="cart-plus" data-key="${item.key}" data-qty="${item.quantity}" aria-label="Increase">+</button>
              </div>
              <button class="ue-cart-line__remove" data-action="cart-remove" data-key="${item.key}">Retirer</button>
            </div>
            <span class="ue-cart-line__price">${money(item.final_line_price)}</span>
          </div>`;
      });
      itemsEl.innerHTML = html;
    });

    // FAB count
    const fabCount = $('#ue-fab-count');
    if (fabCount) fabCount.textContent = cart.item_count;
    const fab = $('#ue-fab');
    if (fab) fab.style.display = cart.item_count > 0 ? 'flex' : (window.innerWidth < 991 ? 'flex' : 'none');

    // Update native cart bubble if present
    const bubble = $('.cart-count-bubble span[aria-hidden]');
    if (bubble) bubble.textContent = cart.item_count;
  }

  /* ======================================================================
     CATEGORY NAV  IntersectionObserver + smooth scroll
     ====================================================================== */
  function initCategoryNav() {
    const nav = $('#ue-cat-nav');
    if (!nav) return;

    const chips = $$('.ue-cat-chip');
    const sections = $$('.ue-category');

    // Smooth scroll on click
    chips.forEach(chip => {
      chip.addEventListener('click', e => {
        e.preventDefault();
        const targetId = chip.getAttribute('href').slice(1);
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + targetId);
      });
    });

    // Observer to highlight active
    if (!sections.length) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const handle = entry.target.dataset.catSection;
          chips.forEach(c => c.classList.toggle('is-active', c.dataset.catLink === handle));
          // Scroll chip into view
          const activeChip = nav.querySelector(`.ue-cat-chip[data-cat-link="${handle}"]`);
          if (activeChip) {
            activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      });
    }, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(s => observer.observe(s));

    // Activate first chip
    if (chips.length) chips[0].classList.add('is-active');
  }

  /* ======================================================================
     MODAL  Variant picker
     ====================================================================== */
  const Modal = {
    overlay: null,
    el: null,
    init() {
      this.overlay = $('#ue-modal-overlay');
      this.el = $('#ue-modal');
      if (!this.el) return;

      // Close triggers
      $('#ue-modal-close')?.addEventListener('click', () => this.close());
      this.overlay?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.el.classList.contains('is-open')) this.close();
      });

      // Qty buttons
      $('[data-action="modal-qty-minus"]')?.addEventListener('click', () => {
        if (modalQty > 1) { modalQty--; this.updateQty(); }
      });
      $('[data-action="modal-qty-plus"]')?.addEventListener('click', () => {
        modalQty++; this.updateQty();
      });

      // ATC
      $('#ue-modal-atc')?.addEventListener('click', () => this.addToCart());
    },

    async open(handle) {
      try {
        const r = await fetch(`/products/${handle}.js`);
        if (!r.ok) throw new Error('Product not found');
        modalProduct = await r.json();
        modalQty = 1;
        modalSelectedVariant = modalProduct.variants[0];
        this.render();
        this.el.classList.add('is-open');
        this.overlay.classList.add('is-open');
        document.body.classList.add('ue-no-scroll');
        this.el.focus();
      } catch (e) {
        Toast.show('Unable to load product');
      }
    },

    close() {
      this.el?.classList.remove('is-open');
      this.overlay?.classList.remove('is-open');
      document.body.classList.remove('ue-no-scroll');
      modalProduct = null;
      modalSelectedVariant = null;
    },

    render() {
      if (!modalProduct) return;
      const p = modalProduct;
      const v = modalSelectedVariant;

      // Image
      const hero = $('#ue-modal-hero');
      const img = $('#ue-modal-img');
      if (p.featured_image) {
        img.src = p.featured_image;
        img.alt = p.title;
        hero.classList.add('has-img');
      } else {
        hero.classList.remove('has-img');
      }

      $('#ue-modal-title').textContent = p.title;
      $('#ue-modal-desc').textContent = p.description
        ? p.description.replace(/<[^>]*>/g, '').substring(0, 200)
        : '';
      $('#ue-modal-price').textContent = money(v.price);

      // Variants
      const variantsEl = $('#ue-modal-variants');
      variantsEl.innerHTML = '';

      if (p.variants.length > 1) {
        // Build option groups
        p.options.forEach((optName, optIdx) => {
          const group = document.createElement('div');
          group.className = 'ue-modal__variant-group';
          group.innerHTML = `<span class="ue-modal__variant-label">${optName}</span>`;

          const optionsWrap = document.createElement('div');
          optionsWrap.className = 'ue-modal__variant-options';

          const seen = new Set();
          p.variants.forEach(variant => {
            const val = variant.options[optIdx];
            if (seen.has(val)) return;
            seen.add(val);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ue-modal__variant-btn';
            btn.textContent = val;
            btn.dataset.optionIndex = optIdx;
            btn.dataset.optionValue = val;

            if (modalSelectedVariant.options[optIdx] === val) {
              btn.classList.add('is-selected');
            }

            // Check availability
            const available = p.variants.some(vv => vv.options[optIdx] === val && vv.available);
            if (!available) btn.classList.add('is-unavailable');

            btn.addEventListener('click', () => this.selectOption(optIdx, val));
            optionsWrap.appendChild(btn);
          });

          group.appendChild(optionsWrap);
          variantsEl.appendChild(group);
        });
      }

      this.updateQty();
    },

    selectOption(optIdx, value) {
      if (!modalProduct) return;
      // Build selected options
      const opts = [...modalSelectedVariant.options];
      opts[optIdx] = value;

      // Find matching variant
      const match = modalProduct.variants.find(v =>
        v.options.every((o, i) => o === opts[i])
      );
      if (match) {
        modalSelectedVariant = match;
        this.render();
      }
    },

    updateQty() {
      const input = $('#ue-modal-qty-input');
      if (input) input.value = modalQty;
      const priceEl = $('#ue-modal-atc-price');
      if (priceEl && modalSelectedVariant) {
        priceEl.textContent = money(modalSelectedVariant.price * modalQty);
      }
      // Disable ATC if unavailable
      const atc = $('#ue-modal-atc');
      if (atc && modalSelectedVariant) {
        atc.disabled = !modalSelectedVariant.available;
        const textEl = atc.querySelector('.ue-modal__atc-text');
        if (textEl) textEl.textContent = modalSelectedVariant.available ? 'Ajouter' : 'Épuisé';
      }
    },

    async addToCart() {
      if (!modalSelectedVariant || !modalSelectedVariant.available) return;
      const atc = $('#ue-modal-atc');
      const spinner = atc?.querySelector('.ue-spinner');
      const textEl = atc?.querySelector('.ue-modal__atc-text');
      const priceEl = atc?.querySelector('.ue-modal__atc-price');
      try {
        if (spinner) spinner.hidden = false;
        if (textEl) textEl.hidden = true;
        if (priceEl) priceEl.hidden = true;
        await CartAPI.add(modalSelectedVariant.id, modalQty);
        renderCart();
        Toast.show('Ajouté au panier!');
        this.close();
      } catch (_) {
        // error already toasted
      } finally {
        if (spinner) spinner.hidden = true;
        if (textEl) textEl.hidden = false;
        if (priceEl) priceEl.hidden = false;
      }
    }
  };

  /* ======================================================================
     DRAWER
     ====================================================================== */
  const Drawer = {
    overlay: null,
    el: null,
    init() {
      this.overlay = $('#ue-drawer-overlay');
      this.el = $('#ue-drawer');
      if (!this.el) return;

      $('#ue-fab')?.addEventListener('click', () => this.open());
      $('#ue-drawer-close')?.addEventListener('click', () => this.close());
      this.overlay?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.el.classList.contains('is-open')) this.close();
      });
    },

    open() {
      this.el?.classList.add('is-open');
      this.overlay?.classList.add('is-open');
      document.body.classList.add('ue-no-scroll');
    },

    close() {
      this.el?.classList.remove('is-open');
      this.overlay?.classList.remove('is-open');
      document.body.classList.remove('ue-no-scroll');
    }
  };

  /* ======================================================================
     QUICK ADD  single-variant products
     ====================================================================== */
  async function quickAdd(btn) {
    const vid = btn.dataset.variantId;
    if (!vid) return;
    btn.classList.add('is-loading');
    try {
      await CartAPI.add(Number(vid), 1);
      renderCart();
      Toast.show('Ajouté au panier!');
    } catch (_) { /* already toasted */ }
    finally { btn.classList.remove('is-loading'); }
  }

  /* ======================================================================
     DELEGATED EVENT LISTENERS
     ====================================================================== */
  function initEvents() {
    document.addEventListener('click', async e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;

      switch (action) {
        case 'quick-add':
          e.preventDefault();
          quickAdd(target);
          break;
        case 'open-modal':
          e.preventDefault();
          Modal.open(target.dataset.productHandle);
          break;
        case 'cart-minus': {
          const key = target.dataset.key;
          const qty = Number(target.dataset.qty);
          await CartAPI.change(key, Math.max(0, qty - 1));
          renderCart();
          break;
        }
        case 'cart-plus': {
          const key = target.dataset.key;
          const qty = Number(target.dataset.qty);
          await CartAPI.change(key, qty + 1);
          renderCart();
          break;
        }
        case 'cart-remove': {
          const key = target.dataset.key;
          await CartAPI.change(key, 0);
          renderCart();
          break;
        }
      }
    });
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  async function init() {
    Toast.init();
    await CartAPI.fetch();
    renderCart();
    initCategoryNav();
    Modal.init();
    Drawer.init();
    initEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
