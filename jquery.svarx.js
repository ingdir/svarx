/**
 *
 * @author         Max A. Shirshin (ingdir@yandex-team.ru)
 * @version        2.36
 * @name           SVARX (Semantical VAlidation Rulesets in XML)
 * @description   jQuery plugin for web form validation using SVARX rule descriptions
 * 
 */

(function($) {
    // Helper functions
    
    // A regexp to get rid of white space characters, much better than just \s
    // as it also handles rare and some strange cases
    var ws = '[\\x09\\x0A-\\x0D\\x20\\xA0\\u1680\\u180E\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]+',
        eventNameSpace = '.svarx' + Math.floor(Math.random() * 10000),
        undefined,
        EMPTY_FUNC = function(){},
        TAG_RULE = 'rule',
        TAG_BLOCK = 'block',
        TAG_VALIDATE = 'validate',
        ATTR_INVERTED = 'inverted',
        ATTR_FAIL_IF_NULL = 'failifnull',
        ATTR_LOGIC = 'logic',
        ATTR_FIRE_ACTS = 'fireacts',
        ATTR_FIELD_COUNT = 'fieldcount',
        ATTR_SVARXID = 'svarxid',
        STR_ERRTARGET = 'errtarget',
        STR_ELEMENT = 'element';
    
    // Select immediate children of root with tagNames listed as remaining args.
    // Return result as an array.
    function filterTags(root) {
        var result = [],
            i = 0,
            j,
            ch = root.childNodes;
        
        while (ch[i]) {
            j = 1;
            while (arguments[j]) {
                if (ch[i].nodeName === arguments[j]) {
                    result.push(ch[i]);
                    break;
                }
                j++;
            }
            i++;
        }
        
        return result;
    }
    
    // Check that attribute value is "true" 
    function isAttrTrue(node, attrName) {
        var attr = node.getAttribute(attrName);
        return (attr === attrName || attr === 'yes' || attr === '1' || attr === 'true');
    }
    
    // Parse value as an integer.
    // If that doesn't work, returns the secondary argument instead.
    function extParseInt(value, fallback) {
        var result = parseInt(value, 10);
        return isNaN(result) ? fallback : result;
    }
    
    // Public API
    var SVARX = $.fn.svarx = function(options) {
        this.filter('form').each(function() {
            /**
             * Shortcut functions to find form elements based on info provided in validation rules
             */
            function $ruleEls(rule) {
                return $elsByRule(rule, STR_ELEMENT);
            }

            function $targetEls(rule) {
                if (rule.getAttribute(STR_ERRTARGET) !== null || filterTags(rule, STR_ERRTARGET).length > 0) {
                    return $elsByRule(rule, STR_ERRTARGET);
                } else return $elsByRule(rule, STR_ELEMENT);
            }

            // basic form element lookup function
            function $getElements() {
                return $getElements.cache || ($getElements.cache = $form.find('input,select,textarea'));
            }
            
            // Drop all internal caches related to element search
            function resetElsCaches() {
                delete $getElements.cache;
                $elsByRule.cache = {};
                $elsByRule.uniq  = 1;
                $elsByRule.json = {};
            }
            
            /**
             * Return rule attributes as JSON; needed for functions that implement validations,
             * both built-in and user-defined.
             */
            function ruleAsJSON(ruleNode) {
                return $.extend({}, $elsByRule.json[ruleNode.getAttribute(ATTR_SVARXID)] || {});
            }
            
            /**
             *
             * Returns a jQuery object with all form elements corresponding
             * to a given SVARX rule
             *
             */
            function $elsByRule(rule, contextId) {
                var uniq = rule.getAttribute(ATTR_SVARXID);
                if (uniq) {
                    var $cached = $elsByRule.cache[uniq + '#' + contextId];
                    if ($cached) {
                        return $cached;
                    }
                }
                
                var context = (contextId == STR_ELEMENT) ? {
                        nameAttr: 'for',
                        itemAttr: 'item',
                        childTag: 'el'
                    } : {  // contextId == 'errtarget'
                        nameAttr: STR_ERRTARGET,
                        itemAttr: 'errtargetitem',
                        childTag: STR_ERRTARGET
                    },
                    name = rule.getAttribute(context.nameAttr),
                    item = extParseInt(rule.getAttribute(context.itemAttr), 0),
                    $all = $getElements(),
                    $result = $form.filter(function() {return false}), // an 1.3.x-proof way of getting an empty jQuery object :-)
                    fieldList = [];

                if (!name) {
                    /**
                    * If there's no "for" attribute (or no "errtarget" in case we're called from $targetEls),
                    * then two cases are possible: either we'll find necessary element definitions in
                    * children tags, or we're dealing with a special case (the rule not associated with any element,
                    * hence no "for" attribute at all) which means we must return the parent form itself.
                    *
                    * If "errtarget" specified in the rule does not exist, the error will be propapated
                    * up to the parent form element.
                    */ 
                    var childTags = filterTags(rule, context.childTag);
                    
                    if (childTags.length > 0) {
                        // dealing with the multi-element rule;
                        // parse inner content.
                        $.each(childTags, function(i, el) {
                            // support for special aliases.
                            // only necessary when this func is called in an "errtarget" context
                            var alias = el.getAttribute('alias');
                            if (alias && contextId == STR_ERRTARGET) {
                                switch (alias) {
                                    case 'children':
                                    // "children" means we take all descendant rule tags,
                                    // calculate their errtargets and add them to the result
                                    $.each(filterTags(rule, TAG_RULE), function(i, el) {
                                        $result = $result.add( $targetEls(el) );
                                    });
                                    break;

                                    // "form" alias means we must trigger error on the form object itself
                                    case 'form':
                                    default:
                                    fieldList.push([undefined, 0]);
                                    break;
                                }
                            } else {
                                fieldList.push([
                                    el.getAttribute('name'),
                                    extParseInt(el.getAttribute('item'), 0)  // first element is the default
                                ]);
                            }
                        });                        
                    } else {
                        // on the subsequent iterations, the element whose name evaluates to false
                        // will be replaced with a parent form reference
                        fieldList.push([undefined, 0]);
                    }
                } else {
                    // this means the rule has only one form field associated with it;
                    // if "item" attribute is unspecified, set it to 0, which means "get the first
                    // form element with that name"
                    fieldList.push([name, item]);
                }

                $.each(fieldList, function(i, el) {
                    // sometimes we have to return the form itself;
                    // in this case, we use a trick: el[0] contains something
                    // that evaluates to false (normally, there's an element name there,
                    // which we believe never evaluates to false)
                    var $elements = !el[0]
                        ? $form
                        : $all.filter(function() {  // never use form.elements, it has all sorts of bugs
                              var name = this.getAttribute('name');
                              return !this.disabled && name && name === el[0];
                          }).eq(el[1]);  // el[1] always contains a number

                    // .add() guarantees uniquiness and removes dupes
                    $result = $result.add($elements);
                });
                
                // unique id must be incremented
                rule.setAttribute(ATTR_SVARXID, ++$elsByRule.uniq);
                
                // cache tag attributes
                $elsByRule.json[$elsByRule.uniq] = {};
                for (var k = 0, l = rule.attributes.length; k < l; k++) {
                    var attrName = rule.attributes.item(k).nodeName;
                    $elsByRule.json[$elsByRule.uniq.toString()][attrName] = rule.getAttribute(attrName);
                }

                // Important: unique key must depend on call context,
                // 'cause the same rule may be called in one context or another
                $elsByRule.cache[$elsByRule.uniq + '#' + contextId] = $result;
                
                return $result;
            }
            $elsByRule.cache = {};
            $elsByRule.uniq  = 1;
            $elsByRule.json = {};

            /**
             *
             * Call the check specified by the rule;
             * elements to be processed are passed from other methods.
             * Here's where the rule's "inverted" attribute is processed.
             * 
             */
            function callRule(type, args, rule) {
                var ruleFunc = SVARX.rules.hasOwnProperty(type) ?
                    SVARX.rules[type] :
                    (SVARX.unknownRuleFactory(type) || function() {return true}),
                check = ruleFunc(args.slice(0), ruleAsJSON(rule));

                // invert logic if necessary
                if (isAttrTrue(rule, ATTR_INVERTED)) {
                    check = !check;
                }
                
                return check;
            }

            function applyRule(rule) {
                var type = rule.getAttribute('type'),
                    elsNonEmpty = [],
                    check = true,
                    // rule must fail if any of the elements is not found
                    failIfNull = isAttrTrue(rule, ATTR_FAIL_IF_NULL),
                    fieldCount = extParseInt(rule.getAttribute(ATTR_FIELD_COUNT), 0);
                
                // Special case: the rule does not request any elements at all.
                // These rules get passed a full set of form elements as an argument.
                //
                // Neither SVARX.nonEmpty() nor ATTR_FAIL_IF_NULL are considered.
                // 
                if (fieldCount === 0) {
                    return callRule(type, $getElements(), rule);
                }

                // Receive elements to be validated (some rules can accept more than one element)
                //
                var $els = $ruleEls(rule).each(function() {
                    if (!SVARX.isTextControl(this) || SVARX.nonEmpty(this)) {
                        elsNonEmpty.push(this);
                    }
                });
        
                // Special case: the number of elements the form contains is not equal
                // to the number of elements requested by the rule.
                // In this case, valiidation is considered TRUE by default,
                // unless there is "failifnull" attribute specified which inverts this default.
                if ($els.size() !== fieldCount) return !failIfNull;
                
                // Special case:
                // validations are not applied to empty fields ("inverted" attribute is ignored in this case),
                // UNLESS this is a "required" rule
                if (elsNonEmpty.length > 0 || type === 'required') {
                    // "required" gets ALL elements, other validations
                    // must be content with non-empty and non-textual ones
                    return callRule(type, type === 'required' ? $els.get() : elsNonEmpty, rule);
                }
                
                // default
                return check;
            }

            // препроцессор XML, разворачивает if-проверки в логические связки
            // по правилам матлогики
            function preprocessXML() {
                // инвертирует значения инвертирующих атрибутов :-)
                function invertNode(node) {
                    $.each([ATTR_INVERTED, ATTR_FAIL_IF_NULL], function(i, attr) {
                        if (isAttrTrue(node, attr)) {
                            node.removeAttribute(attr);
                        } else {
                            node.setAttribute(attr, attr);
                        }
                    });
                }
                
                // обрабатывает узлы block, заменяя if-блоки по правилу
                // A => B = !A or B
                function unwrapIfThenElse(node) {
                    if (node.getAttribute(ATTR_LOGIC) === 'if') {
                        var chNodes = filterTags(node, TAG_RULE, TAG_BLOCK);
                        
                        // if..then или if..then..else
                        if (chNodes.length == 2 || chNodes.length == 3) {
                            node.setAttribute(ATTR_LOGIC, 'or');
                            invertNode(chNodes[0]);
                        }
                        
                        // дополнительная обработка для случая if..then..else
                        if (chNodes.length == 3) {
                            var dupNode = node.cloneNode(true),
                                dupChNodes = filterTags(dupNode, TAG_RULE, TAG_BLOCK);
                                
                            invertNode(dupChNodes[0]);
                            dupNode = node.parentNode.insertBefore(dupNode, node.nextSibling);
                            
                            // из первого набора условий убрать третий узел
                            var condemned = chNodes[2];
                            condemned.parentNode.removeChild(condemned);
                            // из второго набора удаляем второй узел
                            condemned = dupChNodes[1];
                            condemned.parentNode.removeChild(condemned);
                            
                            // объединить полученные узлы логикой and
                            var wrapper = op.svarxXML.createElement(TAG_BLOCK);
                            wrapper.setAttribute(ATTR_LOGIC, 'and');
                            wrapper = node.parentNode.insertBefore(wrapper, node);
                            wrapper.appendChild(node);
                            wrapper.appendChild(dupNode);
                            
                            for (var i = 0, blocks = filterTags(dupNode, TAG_BLOCK), j = blocks.length; i < j; i++) {
                                unwrapIfThenElse(blocks[i]);
                            }
                        }
                    }
                    
                    for (var i = 0, blocks = filterTags(node, TAG_BLOCK), j = blocks.length; i < j; i++) {
                        unwrapIfThenElse(blocks[i]);
                    }
                }

                // посчитать, сколько элементов ждёт на вход правило, чтоб потом уметь понять, всё ли мы нашли
                function countRuleElems(node) {
                    if (node.nodeName === TAG_RULE) {
                        if (node.getAttribute('for')) {
                            node.setAttribute(ATTR_FIELD_COUNT, 1);
                        } else {
                            node.setAttribute(ATTR_FIELD_COUNT, filterTags(node, 'el').length);
                        }
                    }

                    for (var i = 0, blocks = filterTags(node, TAG_RULE, TAG_BLOCK), j = blocks.length; i < j; i++) {
                        countRuleElems(blocks[i]);
                    }
                }
                
                var validateElems = filterTags(op.svarxXML.documentElement, TAG_VALIDATE);
                
                for (var i = 0, j = validateElems.length; i < j; i++) {
                    unwrapIfThenElse(validateElems[i]);
                }

                for (var i = 0, j = validateElems.length; i < j; i++) {
                    countRuleElems(validateElems[i]);
                }
            }

            // снимает ранее стоявшие на форме обработчики
            function unbindHandlers() {
                $form.unbind(eventNameSpace);
            }
            
            // Назначает валидатор на форму
            function bindHandlers() {
                // обработчик-валидатор
                function handler(e) {
                    var validationResult = true,
                        wasPrevented = false,
                        checkPrevented = function(e) {
                            wasPrevented = e.isDefaultPrevented();
                        };
                    
                    // такой метод назначения гарантирует, что обработчик
                    // checkPrevented выполнится последним и мы сможем понять,
                    // был ли предотвращён запуск SVARX-проверки
                    $form
                        .one('beforesvarx', checkPrevented)
                        .trigger('beforesvarx', [e.type]);
                    
                    if (wasPrevented) {
                        // не выполнять SVARX-валидацию, не предотвращать событие
                        return true;
                    }
                    
                    // сбросим закешированные значения элементов формы (если форма не отмечена как неизменная)
                    op.immutable || resetElsCaches();
                    // препроцессинг уже можно выполнять
                    preprocess();
                    validationResult = validate(e.type);
                    
                    $form
                       .one('aftersvarx', checkPrevented)
                       .trigger('aftersvarx', [validationResult, e.type]);
        
                    // событие предотвращает e.preventDefault(), позванный из любого обработчика aftersvarx
                    if (wasPrevented) {
                        e.preventDefault();
                    }
                }
                
                var m = SVARX.methods[op.method] || {};
                unbindHandlers();
                $form
                    .bind('svarxformupdate' + eventNameSpace, resetElsCaches)
                    .bind('beforesvarx'     + eventNameSpace, m.before || EMPTY_FUNC)
                    .bind('aftersvarx'      + eventNameSpace, m.after  || EMPTY_FUNC)
                    .bind('svarxerror'      + eventNameSpace, m.error  || EMPTY_FUNC)
                    .bind(op.bindTo.split(/\s+/).join(eventNameSpace + ' ') + eventNameSpace, handler);
            }


            // Препроцессинг данных формы. Происходит на реальных значениях (не на копии).
            // Выполняется до валидации, но только в том случае, если валидация разрешена
            function preprocess() {
                function preprocessRule(rule) {
                    var type = rule.getAttribute('type');
                    
                    type && $ruleEls(rule).each(function(i, el) {
                        if (SVARX.isTextControl(el)  // препроцессинг работает только для текстовых контролов...
                        && el.type.toLowerCase() !== 'file'  // не срабатывает на полях для загрузки файлов...
                        && !el.readOnly) { // не срабатывает на readonly-полях...
                            // ...а disabled-поля мы убрали ранее в $elsByRule
                            (SVARX.processors[type] || SVARX.unknownPreprocessFactory(type))(el, ruleAsJSON(rule));
                        }
                    });
                }
        
                var preprocessBlocks = filterTags(op.svarxXML.documentElement, 'preprocess'),
                    curPreprocessBlock = preprocessBlocks[0] || null;
                    
                op.preprocessBlockId && $.each(preprocessBlocks, function(i) {
                    if (preprocessBlocks[i].getAttribute('id') === op.preprocessBlockId) {
                        curPreprocessBlock = preprocessBlocks[i];
                        return false;
                    }
                });
                
                curPreprocessBlock && $.each(filterTags(curPreprocessBlock, TAG_RULE), function(i, el) {
                    preprocessRule(el);
                });
            }

            // Главная валидирующая функция
            function validate(eventType) {
                // Рекурсивный обработчик правил валидации, вычисляет
                // общий логический итог проверки и расставляет на XML-дереве
                // маркеры для выполнения назначенных на ошибки действий
                function processRule(ruleNode) {
                    if (!ruleNode) return false;
                    
                    switch (ruleNode.nodeName) {
                        case TAG_RULE:
                            var ruleCheck = applyRule(ruleNode);
                            logicStack.push(ruleCheck);
                        
                            if (!ruleCheck) {
                                // ставим маркер выполнения действий для оповещения об ошибке
                                ruleNode.setAttribute(ATTR_FIRE_ACTS, 1);
                            }
        
                            break;
        
                        case TAG_BLOCK:
                        case TAG_VALIDATE:
                            var ch = filterTags(ruleNode, TAG_RULE, TAG_BLOCK),
                                childCount = ch.length,
                                logic = ruleNode.getAttribute(ATTR_LOGIC) == 'or' ? '||' : '&&';
        
                                for (var i = 0; i < childCount; i++) {
                                    // рекурсивный вызов
                                    processRule(ch[i]);
                                }
                        
                            var tmps = [];
                            for (var i = 0; i < childCount; i++) {
                                tmps.unshift(logicStack.pop());
                            }
                        
                            var thisRuleResult = (childCount > 0) ? (new Function('return (' + tmps.join(logic) + ')'))() : true;
                            if (isAttrTrue(ruleNode, ATTR_INVERTED)) {
                                thisRuleResult = !thisRuleResult;
                            }
                            
                            // запоминаем логический результат вычисления текущего набора правил
                            logicStack.push(thisRuleResult);
                            if (!thisRuleResult) {
                                // ставим маркер выполнения действий для оповещения об ошибке
                                ruleNode.setAttribute(ATTR_FIRE_ACTS, 1);
                            }
        
                            break;
                    }
                }
                
                // Выполняет те из действий, которые соответствуют
                // реально случившимся ошибкам валидации
                function fireActions(ruleNode) {
                    if (!ruleNode || !ruleNode.getAttribute(ATTR_FIRE_ACTS)) return false;
                    ruleNode.removeAttribute(ATTR_FIRE_ACTS);
                    
                    var nodename = ruleNode.nodeName;
                    if (nodename == TAG_RULE || nodename == TAG_BLOCK || nodename == TAG_VALIDATE) {
                        var errCode = ruleNode.getAttribute('onerror');
                        
                        // вызываем ошибку только если onerror был определён
                        if (errCode) {
                            // поддержка переопределения таргета ошибки
                            $targetEls(ruleNode).trigger('svarxerror', [
                                errCode,
                                eventType,
                                ruleAsJSON(ruleNode)
                            ]);
                        }
        
                        if (nodename !== TAG_RULE) {
                            // рекурсивный вызов
                            for (var i = 0, ch = filterTags(ruleNode, TAG_BLOCK, TAG_RULE), j = ch.length; i < j; i++) {
                                fireActions(ch[i]);
                            }
                        }
                    }
                }
        
                // Общий результат валидации формы и стек результатов проверок
                var result = true,
                    logicStack = [],
                    validateElems = filterTags(op.svarxXML.documentElement, TAG_VALIDATE),
                    curValidateBlock = validateElems[0] || null;
                
                op.validateBlockId && $.each(validateElems, function(i) {
                    if (validateElems[i].getAttribute('id') === op.validateBlockId) {
                        curValidateBlock = validateElems[i];
                        return false;
                    }
                });
                
                processRule(curValidateBlock);
                
                result = logicStack.pop();
                if (!result) {
                    fireActions(curValidateBlock);
                }
                
                return result;
            }

            function cloneXML(doc) {
                if (window.ActiveXObject) {
                    var emptyXMLDoc = new ActiveXObject('Msxml2.DOMDocument.3.0');
                } else {
                    var emptyXMLDoc = document.implementation.createDocument('', '', null);
                }

                emptyXMLDoc.appendChild(doc.documentElement.cloneNode(true));
                return emptyXMLDoc;
            }
            
            function init() {
                preprocessXML();  // препроцессинг XML - разворачиваем логические условия
                bindHandlers();  // назначаем обработчики на форму
                $form.trigger('svarxloaded', [cloneXML(op.svarxXML), op]);
            }
            
            var op = $.extend({}, SVARX.options, options || {}),
                form = this,
                $form = $(form);
            
            // если метод не выбран, берём первый имеющийся
            if (op.method === undefined) {
                for (var m in SVARX.methods) {
                    op.method = m;
                    break;
                }
            }
            
            if (op.svarxXML) {
                try {
                    op.svarxXML = cloneXML(op.svarxXML);
                    init();
                } catch(e) {
                    $form.trigger('svarxfailed', [{}, 'Cannot clone XML document', op]);
                }
            } else if (op.svarxURL) {
                $.ajax($.extend({
                    dataType: 'xml',
                    url: op.svarxURL,
                    success: function(responseXML) {
                        op.svarxXML = responseXML;
                        init();
                    },
                    error: function(xhr, status) {
                        $form.trigger('svarxfailed', [xhr, status, op]);
                    }
                }, op.jQueryAjax));
            } else {
                unbindHandlers();
            }
        });
        
        return this;
    };

    $.extend(SVARX, {
        // версия библиотеки
        version: 2.36,
        options: {
            method: undefined,  // имя плагина визуализации валидации
            bindTo: 'submit',  // на какое событие по умолчанию назначаем валидацию
            jQueryAjax: {}  // доп. параметры для jQuery.ajax запроса
        },
        isTextControl: function(el) {
            if (!el.type) {
                return false;
            }
            
            switch(el.type.toLowerCase()) {
                case 'text':
                case 'textarea':
                case 'password':
                case 'hidden':
                case 'file':
                
                // HTML5 stuff :-(
                case 'search':
                case 'email':
                case 'tel':
                case 'url':
                case 'number':
                
                // Считаем их текстовыми
                case 'range':
                case 'color':
                case 'date':
                case 'month':
                case 'week':
                case 'time':
                case 'datetime':
                case 'datetime-local':
                    return true;
                default:
                    return false;
            }
        },
        methods: {},
        rules: {
            // deprecated, DO NOT USE.
            // будет убрана из дефолтной поставки.
            // такая валидация должна описываться кастомным правилом, нет универсального регэкспа
            // для валидации e-mail адреса.
            email: function(els) {
                return /^[a-z\d%_][a-z\d%_.&+\-]*\@([a-z\d][a-z\d\-]*\.)+[a-z]{2,10}$/i.test(els[0].value);
            },
        
            regexp: function(els, rule) {
                // Мы можем проверять как совпадение с полным значением (в стиле Web Forms 2.0),
                // так и по подстроке. Для этого используются разные атрибуты.
                // Если нужна подстрока, надо использовать атрибут partmatch, если полное совпадение —
                // match. Если указаны оба правила, будет проверено только match.
                
                var match = rule.match,
                    partMatch = rule.partmatch,
                    flags = rule.flags || '',
                    el = els[0],
                    re,
                    execResult;
                    
                // RegExp поддерживает только три флага, но флаг g не имеет для нас смысла
                flags = flags.toLowerCase().replace(/[^im]/g, '');
                
                // Т.к. в синтаксисе регулярных выражений могут быть ошибки,
                // создаём объект через try
                try {
                    if (match) {
                        re = new RegExp(match, flags);
                        execResult = re.exec(el.value);
                        return execResult ? execResult[0] === execResult.input : false;
                    } else if (partMatch) {
                        re = new RegExp(partMatch, flags);
                        return re.test(el.value);
                    } else {
                        return true;
                    }
                } catch(err) {
                    return true;
                }
            },
        
            // для радиобаттонов и чекбоксов
            checked: function(els) {
                var type = els[0].type.toLowerCase();
                
                if (type === 'checkbox' || type === 'radio') {
                    return !!els[0].checked;
                } else return true;
            },
        
            // для селектов, одиночных и множественных
            selected: function(els, rule) {
                var option = parseInt(rule.option, 10),
                    el = els[0],
                    type = el.type.toLowerCase();
                
                if (type !== 'select-one' && type !== 'select-multiple') {
                    return true;
                }
                
                if (el.selectedIndex === -1) {
                    // ни одного элемента не выбрано, правило не срабатывает
                    return false;
                }
                
                if (isNaN(option)) {
                    // если одиночный селект, то какая-то опция точно выбрана.
                    // если множественный, и мы на предыдущем шаге не вылетели,
                    // то selectedIndex больше -1 и опять же правило проходит
                    return true;
                }

                if (!el.options[option]) {
                    // если такой опции нет, она не выделена и правило проваливается
                    return false;
                }
                
                // проверять на наличие this.options[option] не надо, это делается выше
                return !!el.options[option].selected;
            },
        
            // проверяет, что 2 или более значения полей формы
            // равны между собой (как числа или как строки);
            // также допускает проверку без учёта регистра
            eq: function(els, rule) {
                var vals = [],
                    initial,
                    nocase,
                    check = true;
                
                for (var i = 0; i < els.length; i++) {
                    vals.push(els[i].value);
                }
                
                switch (rule.comparison) {
                    case 'number':
                        initial = 1 * vals[0];
                        for (var i = 1, j = vals.length; i < j; i++) {
                            if (initial !== (1 * vals[i])) {
                                check = false;
                                break;
                            }
                        }
                    break;
                    
                    case 'string':
                    default:
                        nocase = rule.nocase;
                        if (nocase === 'yes' || nocase === 'nocase' || nocase == 1) {
                            for (var i = 0, j = vals.length; i < j; i++) {
                                vals[i] = vals[i].toLowerCase();
                            }
                        }
                        
                        initial = vals[0];
                        for (var i = 1, j = vals.length; i < j; i++) {
                            if (initial !== vals[i]) {
                                check = false;
                                break;
                            }
                        }
                }
                return check;
            },
            
            range: function(els, rule) {
                var min = parseFloat(rule.min),
                    max = parseFloat(rule.max),
                    numVal = parseFloat(els[0].value);

                if (isNaN(numVal) || (!isNaN(min) && numVal < min) || (!isNaN(max) && numVal > max)) {
                    return false;
                } else return true;
            },
            
            // требует, чтобы поле было непустым.
            // работает только для текстовых полей -- для всех прочих не имеет смысла
            required: function(els) {
                return SVARX.isTextControl(els[0]) ? SVARX.nonEmpty(els[0]) : true;
            }
        },
        processors: {
            parseint: function(el) {
                el.value = extParseInt(el.value, '');
            },
            
            parsefloat: function(el) {
                var tmp = parseFloat(el.value);
                el.value = isNaN(tmp) ? '' : tmp;
            },
            
            trim: function(el) {
                el.value = el.value.replace(new RegExp('^' + ws + '|' + ws + '$', 'g'), '');
            },
            
            normalize: function(el) {
                SVARX.processors.trim(el);
                el.value = el.value.replace(/[^\S\r\n]+/g, ' ');
            },

            nospace: function(el) {
                el.value = el.value.replace(new RegExp(ws, 'g'), '');
            },
            
            uppercase: function(el) {
                el.value = el.value.toUpperCase();
            },
            
            lowercase: function(el) {
                el.value = el.value.toLowerCase();
            }
        },
        nonEmpty: function(el) {
            return el.value !== '';
        },
        unknownRuleFactory: function() {
            return function() {return true};
        },
        unknownPreprocessFactory: function() {
            return EMPTY_FUNC;
        }
    });
})(jQuery);
