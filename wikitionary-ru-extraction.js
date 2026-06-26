// ==UserScript==
// @name         Wiktionary RU Morphology & Verb Table Generator (Ultimate)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  从 ru.wiktionary 提取数据 (双引擎解析，保留名词提取，新增运动词典与动词 HTML 制卡功能)
// @author       You
// @match        https://ru.wiktionary.org/api/rest_v1/page/html/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

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

    // 2. 判断节点边界 (Sandbox)
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

    // 5. 核心解析引擎 (返回所有表格数据)
    const extractMorphology = () => {
        const rawTitle = decodeURIComponent(window.location.pathname.split('/').pop()).replace(/_/g, ' ');
        const finalResults = []; 

        const tables = Array.from(document.querySelectorAll('table.morfotable.ru, table.morphology.ru'));
        const headers = Array.from(document.querySelectorAll('h1, h2'));

        // ================= 硬编码运动动词字典 =================
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

            // 计算沙盒边界
            let ownerHeader = null;
            let nextHeader = null;
            for (let i = headers.length - 1; i >= 0; i--) {
                if (headers[i].compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    ownerHeader = headers[i];
                    if (i < headers.length - 1) nextHeader = headers[i + 1];
                    break;
                }
            }

            // 初始化上下文数据结构
            let wordAccented = rawTitle;
            let grammarInfo = { 
                aspect: null, transitivity: null, motion: null, animacy: null, conjugation: null, zaliznyak: null 
            };
            let audioUrl = null;
            let foundAccent = false;

            // 字典强制嗅探 (最高优先级)
            const baseWordLower = rawTitle.toLowerCase();
            if (DETERMINATE_VERBS.includes(baseWordLower)) {
                grammarInfo.motion = 'determinate';
            } else if (INDETERMINATE_VERBS.includes(baseWordLower)) {
                grammarInfo.motion = 'indeterminate';
            }

            // 1. 提取沙盒内音频
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

            // 2. Header 重音提取
            if (ownerHeader) {
                const headerRawText = ownerHeader.textContent.replace(/\[.*?\]|\(.*?\)|\{.*?\}/g, '').replace(/[-·]/g, '').trim();
                if (headerRawText.replace(/\u0301/g, '').toLowerCase() === rawTitle.toLowerCase()) {
                    wordAccented = headerRawText;
                    foundAccent = true;
                }
            }

            // 3. 在沙盒内遍历提取语法属性
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

                // 核心语法属性带防篡改锁
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
                
                // 文本嗅探兜底：处理字典之外带前缀的派生运动动词
                if (!grammarInfo.motion) {
                    if (text.includes('однонаправленный')) grammarInfo.motion = 'determinate';
                    else if (text.includes('разнонаправленный') || text.includes('ненаправленный')) grammarInfo.motion = 'indeterminate';
                    else if (text.includes('глагол движения')) grammarInfo.motion = 'motion_verb';
                }
                
                // 提取 Zaliznyak 分类
                if (!grammarInfo.zaliznyak) {
                    const zalMatch = text.match(/классификации\s+а\.?\s*зализняка\s*[-—]\s*([^.]+)/);
                    if (zalMatch) grammarInfo.zaliznyak = zalMatch[1].trim();
                }

                // 第一变位判定引擎 (基于文本或分类推导)
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

            // 4. 分类树嗅探兜底 (运动动词)
            if (!grammarInfo.motion) {
                const links = Array.from(document.querySelectorAll('link[href*="Глаголы_движения"]')).filter(node => isNodeInSandbox(node, ownerHeader, nextHeader));
                if (links.length > 0) grammarInfo.motion = 'motion_verb';
            }

            // 5. 第二变位判定引擎 (词尾嗅探兜底)
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
    // 动作 1：提取全量 JSON 数据输出至 Console
    // ==========================================
    const handleExtractJSON = () => {
        const results = extractMorphology();
        if (!results || results.length === 0) {
            alert('❌ 未找到带有 .ru 标识的俄语名词或动词变形表！');
            return;
        }
        console.log(`✅ [Wiktionary Extractor] 提取成功！共找到 ${results.length} 个独立的词条形态。`);
        console.dir(results); 
        alert(`✅ 提取成功！共找到 ${results.length} 个词条形态，请按 F12 打开 Console 查看。`);
    };

    // ==========================================
    // 动作 2：生成 HTML 表格并写入剪贴板
    // ==========================================
    const generateTableHTML = (verbData) => {
        const word = verbData.word || '';
        const g = verbData.grammarInfo || {};
        const conj = verbData.declensionConjugation || {};

        let propsStr = '';
        if (g.aspect === 'perfective') propsStr += '[完]';
        else if (g.aspect === 'imperfective') propsStr += '[未完]';

        if (g.transitivity === 'transitive') propsStr += '[及]';
        else if (g.transitivity === 'intransitive') propsStr += '[不及]';

        if (g.motion === 'determinate') propsStr += '[运|定]';
        else if (g.motion === 'indeterminate') propsStr += '[运|不定]';
        else if (g.motion === 'motion_verb') propsStr += '[运]';

        if (g.conjugation === 'first') propsStr += '[一]';
        else if (g.conjugation === 'second') propsStr += '[二]';
        else if (g.conjugation === 'irregular') propsStr += '[特]';

        const pres = conj.present || { first: {}, second: {}, third: {} };
        const past = conj.past || {};
        const imp = conj.imperative || {};

        const pastStr = [past.masculine, past.feminine, past.neuter, past.plural].filter(Boolean).join(' / ');
        const impStr = [imp.singular, imp.plural].filter(Boolean).join(' / ');

        return `<table>
	<tbody>
		<tr>
			<td></td>
			<th>${word}</th>
		</tr>
		<tr>
			<th>释义</th>
			<td></td>
		</tr>
		<tr>
			<th>属性</th>
			<td> ${propsStr}</td>
		</tr>
		<tr>
			<th>я</th>
			<td>${pres.first?.singular || ''}</td>
		</tr>
		<tr>
			<th>ты</th>
			<td>${pres.second?.singular || ''}</td>
		</tr>
		<tr>
			<th>он/она́</th>
			<td>${pres.third?.singular || ''}</td>
		</tr>
		<tr>
			<th>мы</th>
			<td>${pres.first?.plural || ''}</td>
		</tr>
		<tr>
			<th>вы</th>
			<td>${pres.second?.plural || ''}</td>
		</tr>
		<tr>
			<th>они́</th>
			<td>${pres.third?.plural || ''}</td>
		</tr>
		<tr>
			<th>过去式</th>
			<td>${pastStr}</td>
		</tr>
		<tr>
			<th>命令式</th>
			<td>${impStr}</td>
		</tr>
	</tbody>
</table>`;
    };

    const handleGenerateVerbTable = () => {
        const results = extractMorphology();
        if (!results || results.length === 0) return;

        // 仅过滤出动词
        const verbs = results.filter(v => v.partOfSpeech === 'verb');
        
        // 如果页面只有名词等，静默退出
        if (verbs.length === 0) {
            console.log('👀 页面中没有动词，跳过 HTML 制卡。');
            return; 
        }

        const htmlOutput = verbs.map(v => generateTableHTML(v)).join('<br><br>\n');

        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(htmlOutput, 'text');
            alert('✅ 动词表格 HTML 已成功复制到剪贴板！');
        } else {
            alert('❌ 油猴环境不支持 GM_setClipboard，请检查脚本权限设置。');
        }
    };

    // 注册两个菜单命令
    GM_registerMenuCommand("📥 提取变格变位数据 (JSON)", handleExtractJSON);
    GM_registerMenuCommand("📋 生成并复制动词表格", handleGenerateVerbTable);

})();