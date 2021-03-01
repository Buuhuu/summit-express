/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* global window, navigator, document, fetch */

function toClassName(name) {
  return (name.toLowerCase().replace(/[^0-9a-z]/gi, '-'));
}

export function createTag(name, attrs) {
  const el = document.createElement(name);
  if (typeof attrs === 'object') {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

function wrapSections(element) {
  document.querySelectorAll(element).forEach(($div) => {
    if (!$div.id) {
      const $wrapper = createTag('div', { class: 'section-wrapper' });
      $div.parentNode.appendChild($wrapper);
      $wrapper.appendChild($div);
    }
  });
}

function getLocale(url) {
  const locale = url.pathname.split('/')[1];
  if (/^[a-z-]{2}(-[a-zA-Z-]*)?-[A-Z]{2}$/.test(locale)) {
    return locale;
  }
  return 'en-US';
}

function addDivClasses($element, selector, classes) {
  const $children = $element.querySelectorAll(selector);
  $children.forEach(($div, i) => {
    $div.classList.add(classes[i]);
  });
}

function decorateHeader() {
  const $header = document.querySelector('header');
  const classes = ['logo', 'susi'];
  addDivClasses($header, ':scope>p', classes);
  $header.querySelector('.susi a').classList.add('button');
}

async function fetchBlueprint(pathname) {
  if (window.spark.$blueprint) {
    return (window.spark.$blueprint);
  }

  const bpPath = pathname.substr(pathname.indexOf('/', 1)).split('.')[0];
  const resp = await fetch(`${bpPath}.plain.html`);
  // eslint-disable-next-line no-console
  console.log('fetching...');
  const body = await resp.text();
  const $main = createTag('main');
  $main.innerHTML = body;
  window.spark.$blueprint = $main;
  return ($main);
}

function decorateDoMoreEmbed() {
  document.querySelectorAll('div.embed-internal-domore > div').forEach(($domore) => {
    const $ps = $domore.querySelectorAll(':scope>p');
    const $h2 = $domore.querySelector(':scope>h2');
    const $action = createTag('div', { class: 'actions' });
    if ($h2) {
      $h2.addEventListener('click', () => {
        $action.classList.toggle('open');
        $h2.classList.toggle('open');
      });
    }
    $ps.forEach(($p) => {
      $action.append($p);
    });
    $domore.append($action);
  });
}

function decorateBlocks() {
  document.querySelectorAll('main div.section-wrapper > div > div').forEach(async ($block) => {
    const classes = Array.from($block.classList.values());
    let blockName = classes[0];
    const $section = $block.closest('.section-wrapper');
    if ($section) {
      $section.classList.add(`${blockName}-container`);
    }
    const blocksWithOptions = ['checker-board'];
    blocksWithOptions.forEach((b) => {
      if (blockName.startsWith(`${b}-`)) {
        const options = blockName.substring(b.length + 1).split('-');
        blockName = b;
        $block.classList.add(b);
        $block.classList.add(...options);
      }
    });
    $block.classList.add('block');
    import(`/express/blocks/${blockName}/${blockName}.js`)
      .then((mod) => {
        console.log(blockName, mod);
        mod.default($block, blockName);
      })
      .catch((err) => console.log('failed to load module', err));

    loadCSS(`/express/blocks/${blockName}/${blockName}.css`);
  });
}

/**
 * Loads a CSS file.
 * @param {string} href The path to the CSS file
 */
export function loadCSS(href) {
  if (!document.querySelector(`head > link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    link.onload = () => {
    };
    link.onerror = () => {
    };
    document.head.appendChild(link);
  }
}

export function loadScript(url, callback, type) {
  const $head = document.querySelector('head');
  const $script = createTag('script', { src: url });
  if (type) {
    $script.setAttribute('type', type);
  }
  $head.append($script);
  $script.onload = callback;
}

async function loadLazyFooter() {
  const resp = await fetch('/lazy-footer.plain.html');
  const inner = await resp.text();
  const $footer = document.querySelector('footer');
  $footer.innerHTML = inner;
  $footer.querySelectorAll('a').forEach(($a) => {
    const url = new URL($a.href);
    if (url.hostname === 'spark.adobe.com') {
      const slash = url.pathname.endsWith('/') ? 1 : 0;
      $a.href = url.pathname.substr(0, url.pathname.length - slash);
    }
  });
  wrapSections('footer>div');
  addDivClasses($footer, 'footer > div', ['dark', 'grey', 'grey']);
  const $div = createTag('div', { class: 'hidden' });
  const $dark = document.querySelector('footer .dark>div');

  Array.from($dark.children).forEach(($e, i) => {
    if (i) $div.append($e);
  });

  $dark.append($div);

  $dark.addEventListener('click', () => {
    $div.classList.toggle('hidden');
  });
}

function readBlockConfig($block) {
  const config = {};
  $block.querySelectorAll(':scope>div').forEach(($row) => {
    if ($row.children && $row.children[1]) {
      const name = toClassName($row.children[0].textContent);
      const $a = $row.children[1].querySelector('a');
      let value = '';
      if ($a) value = $a.href;
      else value = $row.children[1].textContent;
      config[name] = value;
    }
  });
  return config;
}

async function fetchBlogIndex() {
  const resp = await fetch('/blog-index.json');
  const json = await resp.json();
  return (json.data);
}

async function filterBlogPosts(locale, filters) {
  if (!window.blogIndex) {
    window.blogIndex = await fetchBlogIndex();
  }
  const index = window.blogIndex;

  const f = {};
  for (const name of Object.keys(filters)) {
    const vals = filters[name];
    let v = vals;
    if (!Array.isArray(vals)) {
      v = [vals];
    }
    // eslint-disable-next-line no-console
    console.log(v);
    f[name] = v.map((e) => e.toLowerCase().trim());
  }

  const result = index.filter((post) => {
    let matchedAll = true;
    for (const name of Object.keys(f)) {
      let matched = false;
      f[name].forEach((val) => {
        if (post[name].toLowerCase().includes(val)) {
          matched = true;
        }
      });
      if (!matched) {
        matchedAll = false;
        break;
      }
    }
    return (matchedAll);
  });

  return (result);
}

function decorateBlogPosts() {
  document.querySelectorAll('main .blog-posts').forEach(async ($blogPosts) => {
    const config = readBlockConfig($blogPosts);
    const posts = await filterBlogPosts('en-US', config);
    $blogPosts.innerHTML = '';
    posts.forEach((post) => {
      const $card = createTag('div', { class: 'card' });
      $card.innerHTML = `<div class="card-image">
        <img loading="lazy" src="${post.image}">
      </div>
      <div class="card-body">
        <h3>${post.title}</h3>
        <p>${post.teaser}</p>
      </div>`;
      $card.addEventListener('click', () => {
        window.location.href = `/${post.path}`;
      });
      $blogPosts.appendChild($card);
    });
  });
}

async function decorateTemplateLists() {
  const $templateLists = Array.from(document.querySelectorAll('main .template-list'));
  for (let i = 0; i < $templateLists.length; i += 1) {
    const $block = $templateLists[i];
    const rows = $block.children.length;
    const locale = getLocale(window.location);
    if (rows === 0 && locale !== 'en-US') {
      // eslint-disable-next-line no-await-in-loop
      const $blueprint = await fetchBlueprint(window.location.pathname);
      $block.innerHTML = $blueprint.querySelectorAll('.template-list')[i].innerHTML;
    }
  }

  /* --- inherit hero image, this should go somewhere else --- */
  const $heroPicture = document.querySelector('.hero-bg');

  if (!$heroPicture && window.spark.$blueprint) {
    const $bpHeroImage = window.spark.$blueprint.querySelector('div:first-of-type img');
    if ($bpHeroImage) {
      const $heroSection = document.querySelector('main .hero');
      const $heroDiv = document.querySelector('main .hero > div');
      const $p = createTag('p');
      const $pic = createTag('picture', { class: 'hero-bg' });
      $pic.appendChild($bpHeroImage);
      $p.append($pic);

      $heroSection.classList.remove('hero-noimage');
      $heroDiv.prepend($p);
    }
  }
}

function postLCP() {
  const martechUrl = '/express/scripts/martech.js';
  loadCSS('/express/styles/lazy-styles.css');
  decorateBlocks();
  loadLazyFooter();
  if (!(window.location.search === '?nomartech' || document.querySelector(`head script[src="${martechUrl}"]`))) {
    let ms = 2000;
    const usp = new URLSearchParams(window.location.search);
    const delay = usp.get('delay');
    if (delay) ms = +delay;
    setTimeout(() => {
      loadScript('/scripts/martech.js', null, 'module');
    }, ms);
  }
  decorateBlogPosts();
  decorateTemplateLists();
}

function decorateHero() {
  const $h1 = document.querySelector('main h1');
  const $heroPicture = $h1.parentElement.querySelector('picture');
  let $heroSection;

  if ($h1) {
    const $main = document.querySelector('main');
    if ($main.children.length === 1) {
      $heroSection = createTag('div', { class: 'section-wrapper hero' });
      const $div = createTag('div');
      $heroSection.append($div);
      if ($heroPicture) {
        $div.append($heroPicture);
      }
      $div.append($h1);
      $main.prepend($heroSection);
    } else {
      $heroSection = $h1.closest('.section-wrapper');
      $heroSection.classList.add('hero');
    }
  }
  if ($heroPicture) {
    $heroPicture.classList.add('hero-bg');
    const $heroImage = $heroPicture.querySelector('img');
    if ($heroImage.complete) {
      postLCP();
    } else {
      $heroImage.addEventListener('load', () => {
        postLCP();
      });
    }
  } else {
    $heroSection.classList.add('hero-noimage');
    postLCP();
  }
}

async function fetchFullIndex(indices) {
  const fullIndex = [];

  await Promise.all(indices.map(async (url) => {
    if (url) {
      const resp = await fetch(url);
      const json = await resp.json();
      // eslint-disable-next-line no-console
      console.log(`${url}: ${json.data.length}`);
      json.data.sort((e1, e2) => e1.path.localeCompare(e2.path));
      fullIndex.push(...json.data.filter((e) => !!e.path));
    }
  }));
  return (fullIndex);
}

function filterMigratedPages(filter) {
  const $results = document.getElementById('page-filter-results');
  const $stats = document.getElementById('page-filter-stats');
  $results.innerHTML = '';
  const index = window.fullIndex;
  let counter = 0;
  if (index) {
    index.forEach((page) => {
      if (page.path.includes(filter)) {
        counter += 1;
        let { path } = page;
        if (!path.startsWith('/')) path = `/${path}`;
        path = path.replace('.html', '');
        let markedUpPath = path;
        if (filter) markedUpPath = path.split(filter).join(`<b>${filter}</b>`);
        const $card = createTag('div', { class: 'card' });
        $card.innerHTML = `<div class="card-image">
          <img loading="lazy" src="${page.image}">
        </div>
        <div class="card-body">
          <h3>${page.title}</h3>
          <p>${markedUpPath}</p>
        </div>`;
        $card.addEventListener('click', () => {
          window.location.href = path;
        });
        $results.appendChild($card);
      }
    });
  }
  $stats.innerHTML = `${counter} page${counter !== 1 ? 's' : ''} found`;
}

async function decorateMigratedPages() {
  const $filterPages = document.querySelector('main .filter-pages');
  if ($filterPages) {
    const config = readBlockConfig($filterPages);

    $filterPages.innerHTML = `<input type="text" id="page-filter" placeholder="type to filter" />
    <div class="stats" id="page-filter-stats"></div>
    <div class="results" id="page-filter-results"></div>`;

    const $pageFilter = document.getElementById('page-filter');
    $pageFilter.addEventListener('keyup', () => {
      filterMigratedPages($pageFilter.value);
    });

    const indices = config.indices.split('.json').map((e) => (e ? `${e}.json` : undefined));

    window.fullIndex = await fetchFullIndex(indices);

    filterMigratedPages($pageFilter.value);
  }
}

function decorateButtons() {
  document.querySelectorAll('main a').forEach(($a) => {
    const $up = $a.parentElement;
    const $twoup = $a.parentElement.parentElement;
    if (!$a.querySelector('img')) {
      if ($up.childNodes.length === 1 && $up.tagName === 'P') {
        $a.className = 'button secondary';
      }
      if ($up.childNodes.length === 1 && $up.tagName === 'STRONG'
          && $twoup.childNodes.length === 1 && $twoup.tagName === 'P') {
        $a.className = 'button primary';
      }
    }
  });
}

function decorateTemplate() {
  if (window.location.pathname.includes('/make/')) {
    document.body.classList.add('make-page');
  }
  const year = window.location.pathname.match(/\/20\d\d\//);
  if (year) {
    document.body.classList.add('blog-page');
  }
}

function decorateLegacyLinks() {
  const legacy = 'https://blog.adobespark.com/';
  document.querySelectorAll(`a[href^="${legacy}"]`).forEach(($a) => {
    // eslint-disable-next-line no-console
    console.log($a);
    $a.href = $a.href.substring(0, $a.href.length - 1).substring(legacy.length - 1);
  });
}

function decorateBlogPage() {
  if (document.body.classList.contains('blog-page')) {
    const $sections = document.querySelectorAll('main>div.section-wrapper>div');
    const $body = $sections[1];
    let $by;
    let $postedOn;
    $body.querySelectorAll('p').forEach(($p) => {
      if (!$by && $p.textContent.toLowerCase().startsWith('by ')) $by = $p;
      if (!$postedOn && $p.textContent.toLowerCase().startsWith('posted on ')) $postedOn = $p;
    });
    const by = $by.textContent.substring(3);
    const posted = $postedOn.textContent.substring(10).split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    $by.innerHTML = `<span class="byline"><img src="/icons/user.svg"> ${by} | ${months[+posted[0] - 1]} ${posted[1]}, ${posted[2]} </span>`;
    $postedOn.remove();
    decorateLegacyLinks();
  }
}

function decorateHowTo() {
  const $head = document.head;
  document.querySelectorAll('main .how-to-steps').forEach(($howto) => {
    const $heading = $howto.previousElementSibling;
    const $rows = Array.from($howto.children);
    const $schema = createTag('script', { type: 'application/ld+json' });
    const schema = {
      '@context': 'http://schema.org',
      '@type': 'HowTo',
      name: $heading.textContent,
      step: [],
    };

    $rows.forEach(($row, i) => {
      const $cells = Array.from($row.children);
      const $number = createTag('div', { class: 'number' });
      $number.innerHTML = `<span>${i + 1}</span>`;
      $row.prepend($number);
      schema.step.push({
        '@type': 'HowToStep',
        position: i + 1,
        name: $cells[0].textContent,
        itemListElement: {
          '@type': 'HowToDirection',
          text: $cells[1].textContent,
        },
      });
      const $h3 = createTag('h3');
      $h3.innerHTML = $cells[0].textContent;
      $cells[1].prepend($h3);
      $cells[1].classList.add('tip');
      $cells[0].remove();
    });
    $schema.innerHTML = JSON.stringify(schema);
    $head.append($schema);
  });
}

async function checkTesting(url) {
  const pathname = new URL(url).pathname.split('.')[0];
  const resp = await fetch('/testing.json');
  const json = await resp.json();
  const matches = json.data.filter((test) => {
    const testPath = new URL(test['Test URLs']).pathname.split('.')[0];
    return testPath === pathname;
  });

  return (!!matches.length);
}

async function decorateTesting() {
  let runTest = true;
  // let reason = '';

  if (await checkTesting(window.location.href)) {
    // eslint-disable-next-line no-console
    console.log('rushing martech');
    loadScript('/scripts/martech.js', null, 'module');
  }

  if (!window.location.host.includes('adobe.com')) {
    runTest = false;
    // reason = 'not prod host';
  }
  if (window.location.hash) {
    runTest = false;
    // reason = 'suppressed by #';
  }
  if (window.location.search === '?test') {
    runTest = true;
  }
  if (navigator.userAgent.match(/bot|crawl|spider/i)) {
    runTest = false;
    // reason = 'bot detected';
  }

  if (runTest) {
    let $testTable;
    document.querySelectorAll('table th').forEach(($th) => {
      if ($th.textContent.toLowerCase().trim() === 'a/b test') {
        $testTable = $th.closest('table');
      }
    });

    const testSetup = [];

    if ($testTable) {
      $testTable.querySelectorAll('tr').forEach(($row) => {
        const $name = $row.children[0];
        const $percentage = $row.children[1];
        const $a = $name.querySelector('a');
        if ($a) {
          const url = new URL($a.href);
          testSetup.push({
            url: url.pathname,
            traffic: parseFloat($percentage.textContent) / 100.0,
          });
        }
      });
    }

    let test = Math.random();
    let selectedUrl = '';
    testSetup.forEach((e) => {
      if (test >= 0 && test < e.traffic) {
        selectedUrl = e.url;
      }
      test -= e.traffic;
    });

    if (selectedUrl) {
      // eslint-disable-next-line no-console
      console.log(selectedUrl);
      const plainUrl = `${selectedUrl.replace('.html', '')}.plain.html`;
      const resp = await fetch(plainUrl);
      const html = await resp.text();
      document.querySelector('main').innerHTML = html;
    }
  } else {
    // eslint-disable-next-line no-console
    // console.log(`Test is not run => ${reason}`);
  }
}
function playYouTubeVideo(vid, $element) {
  $element.innerHTML = `<iframe width="720" height="405" src="https://www.youtube.com/embed/${vid}?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

  /*
  const ytPlayerScript='https://www.youtube.com/iframe_api';
  if (!document.querySelector(`script[src="${ytPlayerScript}"]`)) {
    const tag = document.createElement('script');
    tag.src = ytPlayerScript;
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  if (typeof YT !== 'undefined' && YT.Player) {
    const player = new YT.Player($element.id, {
      height: $element.clientHeight,
      width: $element.clientWidth,
      videoId: vid,
      events: {
          'onReady': (event) => {
            event.target.playVideo();
          },
        }
    });
  } else {
    setTimeout(() => {
      playYouTubeVideo(vid, $element);
    }, 100)
  }
  */
}

function displayTutorial(tutorial) {
  if (tutorial.link.includes('youtu')) {
    const $overlay = createTag('div', { class: 'overlay' });
    const $video = createTag('div', { class: 'overlay-video', id: 'overlay-video' });
    $overlay.appendChild($video);
    window.location.hash = toClassName(tutorial.title);
    const $main = document.querySelector('main');
    $main.append($overlay);
    const yturl = new URL(tutorial.link);
    let vid = yturl.searchParams.get('v');
    if (!vid) {
      vid = yturl.pathname.substr(1);
    }
    $overlay.addEventListener('click', () => {
      window.location.hash = '';
      $overlay.remove();
    });

    playYouTubeVideo(vid, $video);
  } else {
    window.location.href = tutorial.link;
  }

  // eslint-disable-next-line no-console
  console.log(tutorial.link);
}

function createTutorialCard(tutorial) {
  const $card = createTag('div', { class: 'tutorial-card' });
  let img;
  let noimg = '';
  if (tutorial.img) {
    img = `<img src="${tutorial.img}">`;
  } else {
    img = `<div class="badge"></div><div class="title">${tutorial.title}</div>`;
    noimg = 'noimg';
  }

  $card.innerHTML = `<div class="tutorial-card-image">
  </div>
  <div class="tutorial-card-img ${noimg}">
    ${img}
    <div class="duration">${tutorial.time}</div>
  </div>
  <div class="tutorial-card-title">
  <h3>${tutorial.title}</h3>
  </div>
  <div class="tutorial-card-tags">
  <span>${tutorial.tags.join('</span><span>')}</span>
  </div>
  `;
  $card.addEventListener('click', () => {
    displayTutorial(tutorial);
  });
  return ($card);
}

function displayTutorialsByCatgory(tutorials, $results, category) {
  $results.innerHTML = '';

  const matches = tutorials.filter((tut) => tut.categories.includes(category));
  matches.forEach((match) => {
    $results.appendChild(createTutorialCard(match));
  });
}

function toggleCategories($section, show) {
  const children = Array.from($section.children);
  let afterTutorials = false;
  children.forEach(($e) => {
    // eslint-disable-next-line no-console
    console.log($e);
    if (afterTutorials) {
      if (show) {
        $e.classList.remove('hidden');
      } else {
        $e.classList.add('hidden');
      }
    }
    if ($e.classList.contains('tutorials')) {
      afterTutorials = true;
    }
  });
}

function displayFilteredTutorials(tutorials, $results, $filters) {
  $results.innerHTML = '';
  const $section = $results.closest('.section-wrapper > div');
  // eslint-disable-next-line no-console
  console.log($section);
  const filters = (Array.from($filters)).map((f) => f.textContent);
  if (filters.length) {
    toggleCategories($section, false);
    const matches = tutorials.filter((tut) => filters.every((v) => tut.tags.includes(v)));
    matches.forEach((match) => {
      $results.appendChild(createTutorialCard(match));
    });
  } else {
    toggleCategories($section, true);
  }
}

function decorateTutorials() {
  document.querySelectorAll('main .tutorials').forEach(($tutorials) => {
    const tutorials = [];
    const $section = $tutorials.closest('.section-wrapper > div');
    const allTags = [];
    const $rows = Array.from($tutorials.children);
    $rows.forEach(($row, i) => {
      // eslint-disable-next-line no-console
      console.log(i);
      const $cells = Array.from($row.children);
      const $tags = $cells[3];
      const $categories = $cells[2];
      const $title = $cells[0];
      const $img = $cells[4];

      const tags = Array.from($tags.children).map(($tag) => $tag.textContent);
      const categories = Array.from($categories.children).map(($cat) => $cat.textContent);
      const time = $cells[1].textContent;
      const title = $title.textContent;
      const link = $title.querySelector('a').href;
      const img = $img.querySelector('img') ? $img.querySelector('img').src : undefined;

      tutorials.push({
        title, link, time, tags, categories, img,
      });

      tags.forEach((tag) => {
        if (!allTags.includes(tag)) allTags.push(tag);
      });
    });

    $tutorials.innerHTML = '';
    let $results = createTag('div', { class: 'results' });
    $tutorials.appendChild($results);

    const $filters = createTag('div', { class: 'filters' });
    allTags.forEach((tag) => {
      const $tagFilter = createTag('span', { class: 'tag-filter' });
      $tagFilter.innerHTML = tag;
      $filters.appendChild($tagFilter);
      $tagFilter.addEventListener('click', () => {
        $tagFilter.classList.toggle('selected');
        displayFilteredTutorials(tutorials, $results, $filters.querySelectorAll('.selected'));
      });
    });

    $tutorials.prepend($filters);

    const $children = Array.from($section.children);
    let filterFor = '';
    $children.forEach(($e) => {
      // eslint-disable-next-line no-console
      console.log($e.tagName);
      if ($e.tagName === 'H2') {
        if (filterFor) {
          $results = createTag('div', { class: 'results' });
          displayTutorialsByCatgory(tutorials, $results, filterFor);
          $section.insertBefore($results, $e);
        }
        filterFor = $e.textContent;
      }
    });

    if (filterFor) {
      $results = createTag('div', { class: 'results' });
      displayTutorialsByCatgory(tutorials, $results, filterFor);
      $section.appendChild($results);
    }

    if (window.location.hash !== '#') {
      const video = window.location.hash.substr(1);
      tutorials.forEach((tutorial) => {
        if (toClassName(tutorial.title) === video) {
          displayTutorial(tutorial);
        }
      });
    }
  });
}

function decorateMetaData() {
  const $meta = document.querySelector('main .metadata');
  if ($meta) {
    const metaconfig = readBlockConfig($meta);
    const mapping = {
      title: ['og:title', 'twitter:title'],
      description: ['og:description', 'twitter:description', 'description'],
    };
    if (metaconfig.title) document.title = metaconfig.title;

    for (const a of Object.keys(mapping)) {
      if (metaconfig[a]) {
        mapping[a].forEach((b) => {
          let $elem;
          if (b.includes(':')) {
            $elem = document.querySelector(`head meta[property="${b}"]`);
          } else {
            $elem = document.querySelector(`head meta[name="${b}"]`);
          }
          if ($elem) {
            $elem.setAttribute('content', metaconfig[a]);
          }
        });
      }
    }
    $meta.remove();
  }
}

async function decoratePage() {
  await decorateTesting();
  wrapSections('main>div');
  decorateHeader();
  decorateHero();
  decorateTemplate();
  decorateButtons();
  decorateHowTo();
  decorateMigratedPages();
  decorateBlogPage();
  decorateTutorials();
  decorateMetaData();
  decorateDoMoreEmbed();
}

window.spark = {};
decoratePage();