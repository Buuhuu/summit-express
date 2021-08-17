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
/* global */

import { linkImage, createTag, transformLinkToAnimation } from '../../scripts/scripts.js';

function decorateIconList($columnCell) {
  $columnCell.querySelectorAll('p:empty').forEach(($p) => $p.remove());

  const $iconList = createTag('div', { class: 'columns-iconlist' });
  const $icons = [...$columnCell.querySelectorAll('img.icon, svg.icon')];
  if ($icons.length === 1) {
    // treat single icon as brand icon
    $icons[0].classList.add('brand');
    return;
  }
  let $before;
  $icons.forEach(($icon, i) => {
    if (!i) $before = $icon.previousSibling;
    const $iconListRow = createTag('div');
    const $iconListDescription = createTag('div', { class: 'columns-iconlist-description' });
    $iconListDescription.appendChild($icon.nextSibling);
    const $iconDiv = createTag('div', { class: 'columns-iconlist-icon' });
    $iconDiv.appendChild($icon);
    $iconListRow.appendChild($iconDiv);
    $iconListRow.appendChild($iconListDescription);
    $iconList.appendChild($iconListRow);
  });

  if ($icons.length > 0) {
    if ($before) {
      $columnCell.insertBefore($iconList, $before.nextSibling);
    }
  }
}

/**
 * This function ensures headers fit within a 3 line limit and will reduce
 * font size and line height until text falls within this limit!
 */
function scaleHeader() {
  /*
  since stylesheet is static and rem is standardized, we can use constants
  here for calculating what's needed for dynamic resizes
  */
  const convTag2LineHeight = {
    H1: 63.6,
    H2: 48.6,
    H3: 39.96,
    H4: 31.92,
    H5: 31.92,
    H6: 31.92,
  };
  const convTag2FontSize = {
    H1: 60,
    H2: 45,
    H3: 36,
    H4: 28,
    H5: 28,
    H6: 28,
  };
  const maxLines = 3;
  // eslint-disable-next-line no-undef
  document.querySelectorAll('main .columns h1, main .columns h2, main .columns h3, main .columns h4, main .columns h5')
    .forEach((heading) => {
      const { tagName } = heading;
      // eslint-disable-next-line no-undef
      const style = window.getComputedStyle(heading);
      const unit = 'px';
      const { height, lineHeight } = style;
      // dimensions of headings
      const heightInt = parseInt(height.match('\\d+')[0], 10);
      const lineHeightFloat = parseFloat(lineHeight.match('\\d+.\\d+'));
      // should be verifiable by looking at number of lines
      const headerLines = Math.ceil(heightInt / lineHeightFloat);
      // fontSize and lineHeight must be reduced by this much
      const scale = maxLines / headerLines;
      if (scale < 1) {
        const scaledFs = convTag2FontSize[tagName] * scale;
        const scaledLh = convTag2LineHeight[tagName] * scale;
        heading.style.fontSize = scaledFs + unit;
        heading.style.lineHeight = scaledLh + unit;
      }
    });
}

export default function decorate($block) {
  scaleHeader();
  // eslint-disable-next-line no-undef
  const $rows = Array.from($block.children);
  if ($rows.length > 1) {
    $block.classList.add('table');
  }

  let numCols = 0;
  if ($rows[0]) numCols = $rows[0].children.length;

  if (numCols) $block.classList.add(`width-${numCols}-columns`);

  let total = $rows.length;
  const isNumberedList = $block.classList.contains('numbered');
  if (isNumberedList && $block.classList.length > 4) {
    const i = parseInt($block.classList[3], 10);
    // eslint-disable-next-line no-restricted-globals
    if (!isNaN(i)) {
      total = i;
    }
  }

  $rows.forEach(($row, rowNum) => {
    const $cells = Array.from($row.children);
    $cells.forEach(($cell, cellNum) => {
      if ($cell.querySelector('img.icon, svg.icon')) {
        decorateIconList($cell);
      }

      if (cellNum === 0 && isNumberedList) {
        // add number to first cell
        let num = rowNum + 1;
        if (total > 9) {
          // stylize with total for 10 or more items
          num = `${num}/${total} —`;
          if (rowNum < 9) {
            // pad number with 0
            num = `0${num}`;
          }
        } else {
          // regular ordered list style for 1 to 9 items
          num = `${num}.`;
        }
        $cell.innerHTML = `<span class="num">${num}</span>${$cell.innerHTML}`;
      }

      const $pics = $cell.querySelectorAll(':scope picture');
      if ($pics.length === 1 && $pics[0].parentElement.tagName === 'P') {
        // unwrap single picture if wrapped in p tag, see https://github.com/adobe/helix-word2md/issues/662
        const $parentDiv = $pics[0].closest('div');
        const $parentParagraph = $pics[0].parentNode;
        $parentDiv.insertBefore($pics[0], $parentParagraph);
      }

      // this probably needs to be tighter and possibly earlier
      const $a = $cell.querySelector('a');
      if ($pics[0] && $a) {
        if ($a.textContent.startsWith('https://')) {
          if ($a.href.endsWith('.mp4')) {
            transformLinkToAnimation($a);
          } else {
            linkImage($cell);
          }
        }
      }
      if ($a && $a.classList.contains('button')) {
        if ($block.classList.contains('fullsize')) {
          $a.classList.add('xlarge');
        } else if ($a.classList.contains('light')) {
          $a.classList.replace('accent', 'primary');
        }
      }

      $cell.querySelectorAll(':scope p:empty').forEach(($p) => $p.remove());

      $cell.classList.add('column');
      if ($cell.firstElementChild.tagName === 'PICTURE') {
        $cell.classList.add('column-picture');
      }

      const $pars = $cell.querySelectorAll('p');
      for (let i = 0; i < $pars.length; i += 1) {
        if ($pars[i].innerText.match(/Powered by/)) {
          $pars[i].classList.add('powered-by');
        }
      }
    });
  });
}
