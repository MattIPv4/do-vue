/*
Copyright 2022 DigitalOcean

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const ensureDir = require('./ensureDir');

const fetch = import('node-fetch');

const baseHtml = async mode => {
    // Support a blank template for completely local dev
    if (mode === 'blank') {
        return `<!DOCTYPE HTML>
<html lang="en">
    <head>
        <title>Blank Template</title>
    </head>
    <body>
        <div class="app"></div>
    </body>
</html>
`;
    }

    // Support developing a tool for WWW
    if (mode === 'www') {
        const res = await fetch.then(({ default: run }) => run('https://www.digitalocean.com/'));
        return await res.text();
    }

    // Default to a tool for Community tooling
    if (mode === 'community') {
        const res = await fetch.then(({ default: run }) => run('https://www.digitalocean.com/community/tools/blank'));
        return await res.text();
    }

    return null;
}

module.exports = async () => {
    console.log('Fetching Community Tools template from www.digitalocean.com...');

    // Determine the mode
    const mode = process.env.BLANK_TEMPLATE === 'true' ? 'blank' :
        (process.env.WWW_TEMPLATE === 'true' ? 'www' : 'community');

    // Fetch raw template
    let rawHTML = await baseHtml(mode);

    // Parse
    const dom = new JSDOM(rawHTML);
    const { document } = dom.window;

    // Remove scripts
    document.querySelectorAll('script[src]').forEach(node => {
        node.remove();
    });

    // Deal with hard URLs
    document.querySelectorAll('[href]').forEach(node => {
        const href = node.getAttribute('href');
        if (href.startsWith('/')) {
            node.setAttribute('href', `https://www.digitalocean.com${href}`);
        }
    });
    document.querySelectorAll('[src]').forEach(node => {
        const src = node.getAttribute('src');
        if (src.startsWith('/')) {
            node.setAttribute('src', `https://www.digitalocean.com${src}`);
        }
    });
    document.querySelectorAll('[srcset]').forEach(node => {
        const srcset = node.getAttribute('srcset');
        if (srcset.startsWith('/')) {
            node.setAttribute('srcset', `https://www.digitalocean.com${srcset}`);
        }
    });
    document.querySelectorAll('[content]').forEach(node => {
        const content = node.getAttribute('content');
        if (content.startsWith('/')) {
            node.setAttribute('content', `https://www.digitalocean.com${content}`);
        }
    });
    document.querySelectorAll('style').forEach(node => {
        node.innerHTML = node.innerHTML.replace(/url\((["'])?\//g, 'url($1https://www.digitalocean.com/');
    });

    // Inject charset
    if (!document.querySelectorAll('meta[charset="utf-8"]') && !document.querySelectorAll('meta[charset="utf8"]')) {
        const charset = document.createElement('meta');
        charset.setAttribute('charset', 'utf-8');
        document.head.insertBefore(charset, document.head.firstChild);
    }

    // Remove nav log in + sign up buttons
    if (mode === 'www' || mode === 'community') {
        document.querySelectorAll('ul[class*="SecondaryMenu"] li').forEach(node => {
            if (node.innerHTML.toLowerCase().includes('log in') || node.innerHTML.toLowerCase().includes('sign up')) {
                node.remove();
            }
        });
    }

    // Remove www content + fix footer wave
    if (mode === 'www') {
        document.querySelectorAll('body > div > section').forEach(node => {
            node.remove();
        });

        document.querySelector('body > div > div[class*="FooterSeaWave"]').style.backgroundColor = '#fff';
    }

    // Remove community content
    if (mode === 'community') {
        document.querySelectorAll('div[class*="LayoutCommunity"] > div:not([class*="Navigation"])').forEach(node => {
            node.remove();
        });
    }

    // Inject content block
    const content = document.createElement('block');
    content.setAttribute('name', 'content');
    if (mode === 'blank') {
        document.querySelector('body > .app').appendChild(content);
    }
    if (mode === 'www' || mode === 'community') {
        document.querySelector('div[class*="Navigation"] > nav').parentElement.insertAdjacentElement('afterend', content);
    }

    // Inject the title block
    document.querySelector('title').outerHTML = '<block name="title"><title>DigitalOcean</title></block>';

    // Convert back to raw
    rawHTML = dom.serialize();

    // Inject last fetch comment
    rawHTML = rawHTML.replace('<head>', `<!-- Last fetch from www.digitalocean.com @ ${(new Date()).toISOString()} -->\n<head>`);

    // Create target directory
    const baseDir = `${process.cwd()}/build`;
    ensureDir(baseDir);

    // Export
    fs.writeFileSync(`${baseDir}/base.html`, rawHTML, { flag: 'w+' });
    console.log('...fetching & conversion completed, saved to build/base.html');
};
