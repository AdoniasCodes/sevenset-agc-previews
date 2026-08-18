/* ============================================================
   AGC shared behaviour. Loaded by every page.
   GSAP and ScrollTrigger are expected but optional: without them the
   site is fully readable, just static.
   ============================================================ */
(function(){
  "use strict";

  /* ---------- nav state + scroll progress (plain JS, cheap) ---------- */
  var nav = document.getElementById('siteNav');
  var bar = document.querySelector('.scroll-progress');
  var ticking = false;
  function onScroll(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      var y = window.scrollY || 0;
      nav.classList.toggle('scrolled', y > 80);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* ---------- mobile menu ---------- */
  var overlay = document.getElementById('menuOverlay');
  var openBtn = document.getElementById('menuOpen');
  var closeBtn = document.getElementById('menuClose');
  function setMenu(open){
    overlay.classList.toggle('open', open);
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) closeBtn.focus(); else openBtn.focus();
  }
  openBtn.addEventListener('click', function(){ setMenu(true); });
  closeBtn.addEventListener('click', function(){ setMenu(false); });
  overlay.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ setMenu(false); });
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && overlay.classList.contains('open')) setMenu(false);
  });

  /* ---------- global 3D progress channel ---------- */
  window.__AGC = { P: 0 };

  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  /* ---------- motion for everyone who allows it ---------- */
  mm.add('(prefers-reduced-motion: no-preference)', function(){

    /* hero entrance: whole lines only, no character confetti */
    gsap.from('[data-hero-line]', {
      y: 40, opacity: 0, duration: .7, ease: 'power3.out', stagger: .09, delay: .1
    });
    gsap.from('[data-hero]', {
      y: 24, opacity: 0, duration: .6, ease: 'power2.out', stagger: .08, delay: .45
    });

    /* discrete reveals: section headers, flagship content, quotes */
    gsap.utils.toArray('[data-reveal]').forEach(function(el){
      gsap.from(el, {
        y: 32, opacity: 0, duration: .6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 80%', once: true }
      });
    });
    gsap.from('[data-quote]', {
      y: 32, opacity: 0, duration: .6, ease: 'power2.out', stagger: .12,
      scrollTrigger: { trigger: '.quote-grid', start: 'top 80%', once: true }
    });

    /* capabilities rows, 40ms stagger */
    gsap.from('[data-cap]', {
      y: 28, opacity: 0, duration: .55, ease: 'power2.out', stagger: .04,
      scrollTrigger: { trigger: '.cap-list', start: 'top 82%', once: true }
    });

    /* proof strip: reveal + count up once */
    ScrollTrigger.create({
      trigger: '.proof-row', start: 'top 82%', once: true,
      onEnter: function(){
        gsap.from('[data-proof]', { y: 28, opacity: 0, duration: .6, ease: 'power2.out', stagger: .07 });
        document.querySelectorAll('[data-count]').forEach(function(el){
          var end = parseFloat(el.getAttribute('data-count'));
          var dec = parseInt(el.getAttribute('data-decimals'), 10) || 0;
          var suf = el.getAttribute('data-suffix') || '';
          var obj = { v: 0 };
          gsap.to(obj, {
            v: end, duration: 1.2, ease: 'power2.out',
            onUpdate: function(){ el.textContent = obj.v.toFixed(dec) + suf; }
          });
        });
      }
    });

    return function(){};
  });
  /* ---------- desktop-only choreography ----------
     Every block guards its own elements, because these assets are shared by
     every page and only the homepage has the movements, flagship and journey
     sections. ------------------------------------------------------------ */
  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', function(){
    var cleanups = [];

    var movements = document.getElementById('movements');
    var acts = gsap.utils.toArray('.act');
    if (movements && acts.length === 3) {
      movements.classList.add('is-pinned');

      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: movements, start: 'top top', end: '+=300%',
          pin: true, scrub: 0.4, anticipatePin: 1
        }
      });
      gsap.set(acts[1], { autoAlpha: 0 });
      gsap.set(acts[2], { autoAlpha: 0 });
      tl.to({}, { duration: 0.9 })
        .to(acts[0], { autoAlpha: 0, y: -44, duration: 0.25 }, 0.9)
        .fromTo(acts[1], { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 1.05)
        .to({}, { duration: 0.6 }, 1.3)
        .to(acts[1], { autoAlpha: 0, y: -44, duration: 0.25 }, 1.9)
        .fromTo(acts[2], { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 2.05)
        .to({}, { duration: 0.7 }, 2.3);

      /* single global progress P for the 3D: page top through the pin end */
      var pinST = tl.scrollTrigger;
      var pST = ScrollTrigger.create({
        start: 0,
        end: function(){ return pinST.end; },
        onUpdate: function(self){ window.__AGC.P = self.progress; }
      });
      cleanups.push(function(){
        movements.classList.remove('is-pinned');
        gsap.set(acts, { clearProps: 'all' });
        pST.kill();
      });
    }

    /* flagship parallax, about 0.85x */
    var fimg = document.getElementById('flagshipImg');
    if (fimg) {
      gsap.fromTo(fimg, { yPercent: -9 }, {
        yPercent: 3, ease: 'none',
        scrollTrigger: { trigger: '.flagship', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }

    /* journey rail scrub */
    var wrap = document.getElementById('railWrap');
    var track = document.getElementById('railTrack');
    if (wrap && track) {
      gsap.to(track, {
        x: function(){ return Math.min(0, wrap.clientWidth - track.scrollWidth); },
        ease: 'none',
        scrollTrigger: { trigger: '.journey', start: 'top 75%', end: 'bottom 25%', scrub: true, invalidateOnRefresh: true }
      });
    }

    return function(){ cleanups.forEach(function(fn){ fn(); }); };
  });

})();

/* ============================================================
   CONTACT FORM
   Validation failures open a blocking modal with an OK button.
   Never a toast: a toast that vanishes is a message the client never read.
   ============================================================ */
(function(){
  "use strict";
  var form = document.getElementById('contactForm');
  if (!form) return;

  var back = document.getElementById('modalBack');
  var title = document.getElementById('modalTitle');
  var body = document.getElementById('modalBody');
  var ok = document.getElementById('modalOk');
  var lastFocus = null;

  function openModal(h, p){
    title.textContent = h;
    body.textContent = p;
    lastFocus = document.activeElement;
    back.classList.add('open');
    document.body.style.overflow = 'hidden';
    ok.focus();
  }
  function closeModal(){
    back.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  ok.addEventListener('click', closeModal);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && back.classList.contains('open')) closeModal();
  });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name = form.elements['name'].value.trim();
    var email = form.elements['email'].value.trim();
    var message = form.elements['message'].value.trim();

    if (!name || !email || !message) {
      openModal('Something is missing',
        'Please fill in your name, your email address, and a short description of the project before sending.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      openModal('Check that email address',
        'That email address does not look right. Please correct it so we can reply to you.');
      return;
    }
    /* PREVIEW ONLY. Wire this to the real endpoint in the Payload build. */
    openModal('Thank you, we have your enquiry',
      'A member of the AGC team will be in touch within one working day. For anything urgent, call +251 97 409 1900.');
    form.reset();
  });
})();
