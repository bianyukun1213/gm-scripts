// ==UserScript==
// @name         发布博文到长毛象中文站
// @namespace    https://github.com/bianyukun1213
// @version      2025-06-03
// @description  从 his2nd.life 文章页面中提取内容发布到长毛象中文站。
// @author       Hollis
// @match        https://his2nd.life/*/posts/*.html
// @match        https://8000.cs.nas.yinhe.dev:9981/*/posts/*.html
// @icon         https://www.google.com/s2/favicons?sz=64&domain=his2nd.life
// @grant        none
// @run-at       context-menu
// ==/UserScript==

(function() {
    'use strict';

    // https://moyuscript.github.io/MoyuScript/2024/04/17/handle-unicode-in-js/
    class UnicodeUtils {
        // 按 Unicode 码位分割
        static split(str) {
            const arr = [];
            let index = 0;
            while (index < str.length) {
                const codePoint = str.codePointAt(index);
                let char = str[index];
                // 如果 codePoint >= 0x10000，说明是两个码元的字符
                if (codePoint >= 0x10000)
                    char += str[index + 1];
                index += char.length;
                arr.push(char);
            }
            return arr;
        }
        static count(str) {
            return this.split(str).length;
        }
        static slice(str, start, end) {
            return this.split(str).slice(start, end).join('');
        }
    }

    const i18n = {
        zh: {
            contentLimit: 600,
            siteTag: '#他的第二人生',
            title: '标题：',
            author: '作者：',
            publicationTime: '发布时间：',
            description: '描述：',
            excerpt: '摘录：',
            postContent: '正文：',
            link: '链接：',
            additional: '请注意：您在此对于嘟文的互动会被同步至原文页面。若这不是您期望的行为，请不要互动，或私信联系我删除互动。'
        },
        en: {
            contentLimit: 400,
            siteTag: '#His2ndLife',
            title: 'Title: ',
            author: 'Author: ',
            publicationTime: 'Publication time: ',
            description: 'Description: ',
            excerpt: 'Excerpt: ',
            postContent: 'Content: ',
            link: 'Link: ',
            additional: 'Please note: Your interaction with this toot will be synchronized to the original page. If this is not intended, please do not interact, or PM me to delete the interaction.'
        }
    };

    function getPostTitle() {
        return document.getElementById('tide-page-title').innerText;
    }

    function getAuthor() {
        return document.getElementsByClassName('tide-post-meta-author')[0].innerText;
    }

    function getPublicatioinTime() {
        return document.getElementsByClassName('tide-post-meta-date')[0].innerText;
    }

    function getDescription() {
        return document.getElementsByClassName('tide-post-meta-description')[0]?.innerText ?? '';
    }

    function getExcerpt() {
        return document.getElementById('more').previousElementSibling.innerText;
    }

    function getPostContent() {
        const wantedTagNames = [
            'P',
            'DIV',
            'BR',
            'HR',
            'TITLE',
            'H1',
            'H2',
            'H3',
            'H4',
            'H5',
            'H6',
            'OL',
            'UL',
            'LI',
            'PRE',
            'TABLE',
            'TH',
            'TD',
            'BLOCKQUOTE',
            'HEADER',
            'FOOTER',
            'NAV',
            'SECTION',
            'SUMMARY',
            'ASIDE',
            'ARTICLE',
            'ADDRESS'
        ];
        const skipClasses = [
            // 'alertbox alertbox-info',
            // 'alertbox alertbox-warning',
            // 'alertbox alertbox-danger',
            'image-masonry',
            'tide-image-figure',
            'tag-common tabs'
        ];
        let postContent = '';
        const eles = document.getElementsByClassName('e-content')[0].childNodes;
        let ps = []
        let moreFound = false;
        const elesLength = eles.length;
        for (let eleIndex = 0; eleIndex < elesLength; eleIndex++) {
            const ele = eles[eleIndex];
            if (ele.id === 'more') {
                moreFound = true;
                continue;
            }
            else if (wantedTagNames.includes(ele.tagName) && !skipClasses.includes(ele.className) && moreFound) {
                ps.push(ele);
            }
        }
        for (const p of ps) {
            // postContent += (p.innerText.trim() + '\n'); // 用原生的 innerText 而不是 jQuery 的 text()，后者会去除中间的 \n。
            postContent += (p.innerText.trim() + '\n\n'); // 用原生的 innerText 而不是 jQuery 的 text()，后者会去除中间的 \n。
        }
        // postContent = postContent.replace(/\n{2,}/g, '\n'); // 移除多个 \n。
        postContent = postContent.replace(/\n{3,}/g, '\n'); // 移除多个 \n。
        postContent = postContent.replace(/\n+$/, ''); // 移除首 \n。
        postContent = postContent.replace(/^\n+/, ''); // 移除尾 \n。
        return postContent;
    }

    function getLink() {
        return window.location.href;
    }

    let targetLang = prompt('输入语言代码');
    if (targetLang !== null) {
        if (!Object.getOwnPropertyNames(i18n).includes(targetLang))
            targetLang = 'zh';
        const contentLimit = i18n[targetLang].contentLimit;
        let postContent = getPostContent();
        if (postContent.length > contentLimit) // 字数多了的话，m.cmx.im 会 502。
            postContent = UnicodeUtils.slice(postContent, 0, contentLimit).trim() + '…';
        let desc = getDescription();
        if (desc)
            desc = i18n[targetLang].description + desc + '\n\n';
        const finalText = `${i18n[targetLang].siteTag}\n\n${i18n[targetLang].title}${getPostTitle()}\n\n${i18n[targetLang].author}${getAuthor()}\n\n${i18n[targetLang].publicationTime}${getPublicatioinTime()}\n\n${desc}${i18n[targetLang].excerpt}${getExcerpt()}\n\n${i18n[targetLang].postContent}\n\n---\n\n${postContent}\n\n---\n\n${i18n[targetLang].link}${getLink()}\n\n${i18n[targetLang].additional}`;
        // window.open(`https://m.cmx.im/share?text=${encodeURIComponent(finalText)}`, '_blank'); // 分享接口字数限制更严格。
        const textarea = document.createElement('textarea');
        textarea.innerHTML = finalText;
        textarea.style = 'position:absolute;width:100%;height:100%;z-index:500;';
        document.documentElement.appendChild(textarea);
        window.open('https://m.cmx.im/', '_blank', 'popup');
    }
})();
