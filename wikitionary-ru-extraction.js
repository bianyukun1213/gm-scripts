// ==UserScript==
// @name         Wiktionary RU Morphology & Anki Integration
// @namespace    ad680c9c-02b5-4710-9bcc-be32c1df8a13
// @version      1.0.0
// @description  从 ru.wiktionary 提取数据并一键生成 Anki 记忆卡片
// @author       Hollis
// @match        https://ru.wiktionary.org/api/rest_v1/page/html/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
    'use strict';

    // ================= 配置区 =================
    const ANKI_DECK_NOUN = '俄语名词变格'; // 你的名词牌组名称
    const ANKI_MODEL_NOUN = 'RussianNoun'; // 你的名词模板名称

    const ANKI_DECK_VERB = '俄语动词变位'; // 你的动词牌组名称
    const ANKI_MODEL_VERB = 'RussianVerb'; // 你的动词模板名称
    // ==========================================

    // 1. 高级文本清理
    const cleanNode = (node) => {
        if (!node) return '';
        const clone = node.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith(' / '));
        let text = clone.textContent || '';
        return text.replace(/&#160;/g, ' ').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ')
            .replace(/\n/g, '').replace(/\/\/\s*\//g, '//').replace(/\s+/g, ' ')
            .replace(/△/g, '').trim();
    };

    // 2. 判断节点边界
    const isNodeInSandbox = (node, startNode, endNode) => {
        if (startNode) {
            const afterStart = startNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
            const insideStart = startNode.contains(node);
            if (!afterStart && !insideStart && startNode !== node) return false;
        }
        if (endNode) {
            const beforeEnd = endNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING;
            if (!beforeEnd) return false;
        }
        return true;
    };

    // 3. 解析名词表格
    const parseNounTable = (table) => {
        const forms = {};
        const caseMap = {
            'им': 'nominative', 'р': 'genitive', 'д': 'dative', 'в': 'accusative',
            'тв': 'instrumental', 'пр': 'prepositional', 'зв': 'vocative',
            'м': 'locative', 'разд': 'partitive', 'счетн': 'count'
        };
        const sortedRuCases = Object.keys(caseMap).sort((a, b) => b.length - a.length);

        table.querySelectorAll('tr').forEach(row => {
            const th = row.querySelector('th');
            const tds = row.querySelectorAll('td');
            if (th && tds.length >= 2) {
                const caseName = cleanNode(th).replace(/\./g, '').replace(/\s/g, '').toLowerCase();
                for (let ruCase of sortedRuCases) {
                    if (caseName.startsWith(ruCase)) {
                        forms[caseMap[ruCase]] = { singular: cleanNode(tds[0]), plural: cleanNode(tds[1]) };
                        break;
                    }
                }
            }
        });
        return forms;
    };

    // 4. 解析动词表格
    const parseVerbTable = (table) => {
        const forms = {
            present: { first: {}, second: {}, third: {} },
            past: { masculine: null, feminine: null, neuter: null, plural: null },
            imperative: { singular: null, plural: null }
        };
        let currentTense = null;

        table.querySelectorAll('tr').forEach(row => {
            const ths = row.querySelectorAll('th');
            const tds = row.querySelectorAll('td');

            if (ths.length === 1 && ths[0].colSpan >= 2) {
                const headerText = cleanNode(ths[0]).toLowerCase();
                if (headerText.includes('настоящее') || headerText.includes('будущее')) currentTense = 'present';
                else if (headerText.includes('прошедшее')) currentTense = 'past';
                else if (headerText.includes('повелительное')) currentTense = 'imperative';
                else currentTense = null;
                return;
            }

            if (!currentTense || ths.length === 0) return;
            const rowHeader = cleanNode(ths[0]).toLowerCase();

            if (currentTense === 'present') {
                let key = rowHeader.includes('1-е') ? 'first' : rowHeader.includes('2-е') ? 'second' : rowHeader.includes('3-е') ? 'third' : null;
                if (key && tds.length >= 2) {
                    forms.present[key].singular = cleanNode(tds[0]);
                    forms.present[key].plural = cleanNode(tds[1]);
                }
            } else if (currentTense === 'past') {
                if (rowHeader.includes('м. р.')) {
                    forms.past.masculine = cleanNode(tds[0]);
                    if (tds[1]) forms.past.plural = cleanNode(tds[1]);
                } else if (rowHeader.includes('ж. р.')) forms.past.feminine = cleanNode(tds[0]);
                else if (rowHeader.includes('с. р.')) forms.past.neuter = cleanNode(tds[0]);
            } else if (currentTense === 'imperative') {
                if (rowHeader.includes('2-е') && tds.length >= 2) {
                    forms.imperative.singular = cleanNode(tds[0]);
                    forms.imperative.plural = cleanNode(tds[1]);
                }
            }
        });
        return forms;
    };

    // 5. 核心解析引擎
    const extractMorphology = () => {
        const rawTitle = decodeURIComponent(window.location.pathname.split('/').pop()).replace(/_/g, ' ');
        const finalResults = [];

        const tables = Array.from(document.querySelectorAll('table.morfotable.ru, table.morphology.ru'));
        const headers = Array.from(document.querySelectorAll('h1, h2'));

        const DETERMINATE_VERBS = ['идти', 'итти', 'ехать', 'бежать', 'лететь', 'плыть', 'тащить', 'катить', 'нести', 'вести', 'везти', 'гнать', 'брести', 'лезть', 'ползти'];
        const INDETERMINATE_VERBS = ['ходить', 'ездить', 'бегать', 'летать', 'плавать', 'таскать', 'катать', 'носить', 'водить', 'возить', 'гонять', 'бродить', 'лазить', 'лазать', 'ползать'];

        for (let table of tables) {
            const tableText = cleanNode(table).toLowerCase();
            let tableType = null;
            let declensionConjugation = null;

            if (tableText.includes('падеж') && (tableText.includes('ед. ч.') || tableText.includes('ед. число'))) {
                tableType = 'noun';
                declensionConjugation = parseNounTable(table);
            } else if ((tableText.includes('настоящее') || tableText.includes('будущее')) && tableText.includes('1-е лицо')) {
                tableType = 'verb';
                declensionConjugation = parseVerbTable(table);
            }
            if (!tableType) continue;

            let ownerHeader = null;
            let nextHeader = null;
            for (let i = headers.length - 1; i >= 0; i--) {
                if (headers[i].compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    ownerHeader = headers[i];
                    if (i < headers.length - 1) nextHeader = headers[i + 1];
                    break;
                }
            }

            let wordAccented = rawTitle;
            let grammarInfo = {
                aspect: null, transitivity: null, motion: null, animacy: null, conjugation: null, zaliznyak: null, gender: null
            };
            let audioUrl = null;
            let foundAccent = false;

            const baseWordLower = rawTitle.toLowerCase();
            if (DETERMINATE_VERBS.includes(baseWordLower)) grammarInfo.motion = 'determinate';
            else if (INDETERMINATE_VERBS.includes(baseWordLower)) grammarInfo.motion = 'indeterminate';

            const sandboxAudios = Array.from(document.querySelectorAll('audio')).filter(node => isNodeInSandbox(node, ownerHeader, nextHeader));
            if (sandboxAudios.length > 0) {
                const source = sandboxAudios[0].querySelector('source[type*="audio/ogg"], source');
                if (source) {
                    let src = source.getAttribute('src');
                    if (src.startsWith('//')) src = 'https:' + src;
                    else if (src.startsWith('/')) src = 'https://ru.wiktionary.org' + src;
                    audioUrl = src;
                }
            }

            if (ownerHeader) {
                const headerRawText = ownerHeader.textContent.replace(/\[.*?\]|\(.*?\)|\{.*?\}/g, '').replace(/[-·]/g, '').trim();
                if (headerRawText.replace(/\u0301/g, '').toLowerCase() === rawTitle.toLowerCase()) {
                    wordAccented = headerRawText;
                    foundAccent = true;
                }
            }

            const paragraphs = Array.from(document.querySelectorAll('p')).filter(node => isNodeInSandbox(node, ownerHeader, nextHeader));
            for (let p of paragraphs) {
                const text = (p.textContent || '').toLowerCase();

                if (!foundAccent) {
                    const bNode = p.querySelector('b, strong');
                    if (bNode) {
                        const rawText = bNode.textContent.replace(/[-·]/g, '').trim();
                        if (rawText.replace(/\u0301/g, '').toLowerCase() === rawTitle.toLowerCase()) {
                            wordAccented = rawText;
                            foundAccent = true;
                        }
                    }
                }

                if (!grammarInfo.aspect) {
                    if (text.includes('несовершенный вид')) grammarInfo.aspect = 'imperfective';
                    else if (text.includes('совершенный вид')) grammarInfo.aspect = 'perfective';
                }
                if (!grammarInfo.transitivity) {
                    if (text.includes('непереходный')) grammarInfo.transitivity = 'intransitive';
                    else if (text.includes('переходный') && !text.includes('непереходный')) grammarInfo.transitivity = 'transitive';
                }
                if (!grammarInfo.animacy) {
                    if (text.includes('неодушевлённое')) grammarInfo.animacy = 'inanimate';
                    else if (text.includes('одушевлённое') && !text.includes('неодушевлённое')) grammarInfo.animacy = 'animate';
                }
                // 提取名词性别
                if (!grammarInfo.gender) {
                    if (text.includes('мужской род')) grammarInfo.gender = 'masculine';
                    else if (text.includes('женский род')) grammarInfo.gender = 'feminine';
                    else if (text.includes('средний род')) grammarInfo.gender = 'neuter';
                }

                if (!grammarInfo.motion) {
                    if (text.includes('однонаправленный')) grammarInfo.motion = 'determinate';
                    else if (text.includes('разнонаправленный') || text.includes('ненаправленный')) grammarInfo.motion = 'indeterminate';
                    else if (text.includes('глагол движения')) grammarInfo.motion = 'motion_verb';
                }

                if (!grammarInfo.zaliznyak) {
                    const zalMatch = text.match(/классификации\s+а\.?\s*зализняка\s*[-—]\s*([^.]+)/);
                    if (zalMatch) grammarInfo.zaliznyak = zalMatch[1].trim();
                }

                if (!grammarInfo.conjugation) {
                    if (text.includes('изолированное спряжение') || text.includes('разноспрягаемый')) {
                        grammarInfo.conjugation = 'irregular';
                    } else if (grammarInfo.zaliznyak) {
                        const numMatch = grammarInfo.zaliznyak.match(/\d+/);
                        if (numMatch) {
                            const classNum = parseInt(numMatch[0], 10);
                            grammarInfo.conjugation = (classNum === 4 || classNum === 5) ? 'second' : 'first';
                        }
                    }
                }
            }

            if (!grammarInfo.motion) {
                const links = Array.from(document.querySelectorAll('link[href*="Глаголы_движения"]')).filter(node => isNodeInSandbox(node, ownerHeader, nextHeader));
                if (links.length > 0) grammarInfo.motion = 'motion_verb';
            }

            if (tableType === 'verb' && !grammarInfo.conjugation) {
                const tyForm = declensionConjugation?.present?.second?.singular;
                if (tyForm) {
                    const cleanTyForm = tyForm.replace(/\u0301/g, '').toLowerCase();
                    if (cleanTyForm.endsWith('ишь')) grammarInfo.conjugation = 'second';
                    else if (cleanTyForm.endsWith('ешь') || cleanTyForm.endsWith('ёшь')) grammarInfo.conjugation = 'first';
                    else grammarInfo.conjugation = 'irregular';
                }
            }

            finalResults.push({
                word: wordAccented,
                partOfSpeech: tableType,
                audio: audioUrl,
                grammarInfo: grammarInfo,
                declensionConjugation: declensionConjugation
            });
        }
        return finalResults;
    };

    // ==========================================
    // AnkiConnect 通信层
    // ==========================================
    const sendToAnki = (notes) => {
        GM_xmlhttpRequest({
            method: "POST",
            url: "http://127.0.0.1:8765",
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ action: "addNotes", version: 6, params: { notes: notes } }),
            onload: function (response) {
                try {
                    const result = JSON.parse(response.responseText);
                    if (result.error) {
                        alert('AnkiConnect 报错: ' + result.error);
                    } else {
                        alert(`成功导入 ${notes.length} 个卡片到 Anki！`);
                    }
                } catch (e) {
                    alert('解析 AnkiConnect 响应失败。');
                }
            },
            onerror: function () {
                alert('无法连接到 AnkiConnect。请确保:\n1. Anki 正在后台运行。\n2. 已安装 AnkiConnect 插件。\n3. 如果还是不行，请检查插件的 webCorsOriginList 配置。');
            }
        });
    };

    // 构建 Noun Note
    const buildNounNote = (data) => {
        const g = data.grammarInfo;
        const d = data.declensionConjugation || {};
        const tags = [];
        let explanation = '';

        const baseWordLower = (data.word || '').replace(/\u0301/g, '').toLowerCase();

        // 标签：词性与软音符号解释
        if (baseWordLower.endsWith('ь')) {
            if (g.gender === 'masculine') explanation = '[阳]';
            if (g.gender === 'feminine') explanation = '[阴]';
        }

        // 标签：词性不顺应拼写
        if (g.gender === 'masculine' && (baseWordLower.endsWith('а') || baseWordLower.endsWith('я'))) {
            tags.push('词性不顺应拼写');
        }

        // 标签：复数为特殊变化
        const nomPlural = (d.nominative?.plural || '').replace(/\u0301/g, '').toLowerCase();
        if (nomPlural) {
            // 阳性辅音结尾，标准复数应为 ы/и。如果是 а/я (如 глаза, дома)，则打标签
            if (g.gender === 'masculine' && !baseWordLower.match(/[аяоеёьй]$/)) {
                if (nomPlural.endsWith('а') || nomPlural.endsWith('я')) tags.push('复数为特殊变化');
            }
            // 无论什么词性，以 ья 结尾的复数 (如 братья, деревья) 均算特殊
            if (nomPlural.endsWith('ья')) tags.push('复数为特殊变化');
        }

        const note = {
            deckName: ANKI_DECK_NOUN,
            modelName: ANKI_MODEL_NOUN,
            fields: {
                "word": data.word || "",
                "explanation": explanation,
                "comment": "",
                "nominative.singular": d.nominative?.singular || "",
                "nominative.plural": d.nominative?.plural || "",
                "genitive.singular": d.genitive?.singular || "",
                "genitive.plural": d.genitive?.plural || "",
                "dative.singular": d.dative?.singular || "",
                "dative.plural": d.dative?.plural || "",
                "accusative.singular": d.accusative?.singular || "",
                "accusative.plural": d.accusative?.plural || "",
                "instrumental.singular": d.instrumental?.singular || "",
                "instrumental.plural": d.instrumental?.plural || "",
                "prepositional.singular": d.prepositional?.singular || "",
                "prepositional.plural": d.prepositional?.plural || ""
            },
            tags: tags,
            options: { allowDuplicate: true }
        };

        if (data.audio) {
            const fileName = decodeURIComponent(data.audio.split('/').pop().replace(/\?.*$/, ''));
            note.audio = [{ url: data.audio, filename: fileName, fields: ["audio"] }];
        }
        return note;
    };

    // 构建 Verb Note
    const buildVerbNote = (data) => {
        const g = data.grammarInfo;
        const conj = data.declensionConjugation || {};
        const tags = [];

        if (g.aspect === 'perfective') tags.push('完成体');
        if (g.aspect === 'imperfective') tags.push('未完成体');
        if (g.transitivity === 'transitive') tags.push('及物动词');
        if (g.transitivity === 'intransitive') tags.push('不及物动词');
        if (g.motion === 'motion_verb') tags.push('运动动词');
        if (g.motion === 'determinate') tags.push('定向动词');
        if (g.motion === 'indeterminate') tags.push('不定向动词');
        if (g.conjugation === 'first') tags.push('第一式变位');
        if (g.conjugation === 'second') tags.push('第二式变位');
        if (g.conjugation === 'irregular') tags.push('不规则变位');

        const pres = conj.present || {};
        const past = conj.past || {};
        const imp = conj.imperative || {};

        const note = {
            deckName: ANKI_DECK_VERB,
            modelName: ANKI_MODEL_VERB,
            fields: {
                "word": data.word || "",
                "explanation": "",
                "comment": "",
                "pres.first.singular": pres.first?.singular || "",
                "pres.second.singular": pres.second?.singular || "",
                "pres.third.singular": pres.third?.singular || "",
                "pres.first.plural": pres.first?.plural || "",
                "pres.second.plural": pres.second?.plural || "",
                "pres.third.plural": pres.third?.plural || "",
                "past.masculine": past.masculine || "",
                "past.feminine": past.feminine || "",
                "past.neuter": past.neuter || "",
                "past.plural": past.plural || "",
                "imp.singular": imp.singular || "",
                "imp.plural": imp.plural || ""
            },
            tags: tags,
            options: { allowDuplicate: true }
        };

        if (data.audio) {
            const fileName = decodeURIComponent(data.audio.split('/').pop().replace(/\?.*$/, ''));
            note.audio = [{ url: data.audio, filename: fileName, fields: ["audio"] }];
        }
        return note;
    };

    // ==========================================
    // 菜单触发逻辑
    // ==========================================
    const handleExtractJSON = () => {
        const results = extractMorphology();
        if (!results || results.length === 0) {
            alert('未找到变位表！'); return;
        }
        console.log(`提取成功！共找到 ${results.length} 个词条形态。`);
        console.dir(results);
        alert(`提取成功！共找到 ${results.length} 个词条形态，请按 F12 打开 Console 查看。`);
    };

    const handleGenerateVerbTableHTML = () => {
        const results = extractMorphology();
        if (!results) return;
        const verbs = results.filter(v => v.partOfSpeech === 'verb');
        if (verbs.length === 0) return;

        const generateTableHTML = (verbData) => {
            const word = verbData.word || '';
            const g = verbData.grammarInfo || {};
            const conj = verbData.declensionConjugation || {};
            let propsStr = '';
            if (g.aspect === 'perfective') propsStr += '[完]'; else if (g.aspect === 'imperfective') propsStr += '[未完]';
            if (g.transitivity === 'transitive') propsStr += '[及]'; else if (g.transitivity === 'intransitive') propsStr += '[不及]';
            if (g.motion === 'determinate') propsStr += '[运|定]'; else if (g.motion === 'indeterminate') propsStr += '[运|不定]'; else if (g.motion === 'motion_verb') propsStr += '[运]';
            if (g.conjugation === 'first') propsStr += '[一]'; else if (g.conjugation === 'second') propsStr += '[二]'; else if (g.conjugation === 'irregular') propsStr += '[特]';

            const pres = conj.present || { first: {}, second: {}, third: {} };
            const past = conj.past || {};
            const imp = conj.imperative || {};
            const pastStr = [past.masculine, past.feminine, past.neuter, past.plural].filter(Boolean).join(' / ');
            const impStr = [imp.singular, imp.plural].filter(Boolean).join(' / ');

            return `<table>
    <tbody>
        <tr>
            <td></td>
            <th>${word}</th></tr>
        <tr>
            <th>释义</th>
            <td></td>
        </tr>
        <tr>
            <th>属性</th>
            <td>${propsStr}</td></tr>
        <tr>
            <th>я</th>
            <td>${pres.first?.singular || ''}</td></tr>
        <tr>
            <th>ты</th>
            <td>${pres.second?.singular || ''}</td></tr>
        <tr>
            <th>он/она́</th>
            <td>${pres.third?.singular || ''}</td></tr>
        <tr>
            <th>мы</th>
            <td>${pres.first?.plural || ''}</td></tr>
        <tr>
            <th>вы</th>
            <td>${pres.second?.plural || ''}</td></tr>
        <tr>
            <th>они́</th>
            <td>${pres.third?.plural || ''}</td></tr>
        <tr>
            <th>过去式</th>
            <td>${pastStr}</td></tr>
        <tr>
            <th>命令式</th>
            <td>${impStr}</td></tr>
    </tbody>
</table>`;
        };

        const htmlOutput = verbs.map(v => generateTableHTML(v)).join('\n');
        GM_setClipboard(htmlOutput, 'text');
        alert('动词表格 HTML 已成功复制到剪贴板！');
    };

    const handleExportToAnki = () => {
        const results = extractMorphology();
        if (!results || results.length === 0) {
            alert('页面中未找到可提取的变格变位数据！');
            return;
        }

        const notes = [];
        results.forEach(item => {
            if (item.partOfSpeech === 'noun') notes.push(buildNounNote(item));
            else if (item.partOfSpeech === 'verb') notes.push(buildVerbNote(item));
        });

        if (notes.length > 0) {
            sendToAnki(notes);
        }
    };

    GM_registerMenuCommand("提取变格变位数据 (JSON)", handleExtractJSON);
    GM_registerMenuCommand("生成并复制动词表格 (HTML)", handleGenerateVerbTableHTML);
    GM_registerMenuCommand("导出当前词汇到 Anki", handleExportToAnki);

})();