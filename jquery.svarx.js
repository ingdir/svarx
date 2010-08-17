//
// @author         Max A. Shirshin (ingdir@yandex-team.ru)
// @version        1.20
// @name           SVARX web form validator (based on jQuery)
// @description    Automated form validation using SVARX format (Simple VAlidation Rulesets in XML)
//

(function($) {
    // Специальный регэксп для правильной замены пробельных символов
    var ws = '[\\x09\\x0A-\\x0D\\x20\\xA0\\u1680\\u180E\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]+',
        extWhiteSpace = '^' + ws + '|' + ws + '$',
        undefined;
    
    function applyRules(form, rule) {
        // Определяем набор элементов, переданных для валидации
        // (некоторые правила могут принимать на вход более одного элемента).
        var fieldList = $(rule).attr('for').split(/\s+/),
            typeList = $(rule).attr('type').split(/\s+/),
            els = [],
            allEmpty = true,
            check = true;
            
        $.each(fieldList, function(index, val) {
            $(form)
                .find('input,select,textarea')
                .filter(function() {
                    return !this.disabled && this.getAttribute('name') === val;
                })
                .each(function() {
                    els.push(this);
                });
        });

        // Специальный случай: не найдено ни одного существующего элемента формы.
        // В этом случае SVARX-валидация считает проверку истинной.
        if (els.length == 0) {
            return true;
        }

        for (var i = 0, j = els.length; i < j; i++) {
            if (!$.fn.svarx.isTextControl(els[i]) || els[i].value !== '') {
                allEmpty = false;
                break;
            }
        }
        
        // собственно валидация
        $.each(typeList, function(index, type) {
            // Специальный случай:
            // как обычная, так и инвертированная проверка правил НЕ СРАБАТЫВАЮТ на пустых полях,
            // кроме случая, когда проверяется правило required
            if (!(allEmpty && type !== 'required')) {
                // изначально check === true, поэтому всё ок.
                // массив элементов каждый раз клонируется, чтобы методы валидации
                // не могли его случайно модифицировать
                check = check && !!($.fn.svarx.rules[type] || function() {return true})(els.slice(0), rule);
                // если логика проверки инвертирована, учесть это
                if (isInverted(rule)) {
                    check = !check;
                }
            }

            // если false, то более не итерируемся
            return check;
        });
        
        return check;
    }
    
    // Ф-ция нужна, чтобы отфильтровать узлы в порядке документа.
    // Использование .children('rule,block') даёт js-ошибку в IE7
    function filterTags() {
        return (this.nodeName == 'rule' || this.nodeName == 'block');
    }
   
    // препроцессор XML, разворачивает if-проверки в логические связки
    // по правилам матлогики
    function preprocessXML(tree) {
        // обрабатывает узлы block, заменяя if-блоки по правилу
        // A => B = !A or B
        function preprocessNode(node) {
            if (node.getAttribute('logic') == 'if') {
                var chNodes = $(node).children().filter(filterTags);
                // if..then или if..then..else
                if (chNodes.size() == 2 || chNodes.size() == 3) {
                    node.setAttribute('logic', 'or');
                    
                    var conditionElement = $(node).children().filter(filterTags).get(0);
                    if (isInverted(conditionElement)) {
                        conditionElement.removeAttribute('inverted');
                    } else {
                        conditionElement.setAttribute('inverted', 'inverted');
                    }
                }
                
                // дополнительная обработка для случая if..then..else
                if (chNodes.size() == 3) {
                    var dupNode = node.cloneNode(true),
                        dupChNodes = $(dupNode).children().filter(filterTags),
                        dupConditionElement = dupChNodes.get(0);
                    if (isInverted(dupConditionElement)) {
                        dupConditionElement.removeAttribute('inverted');
                    } else {
                        dupConditionElement.setAttribute('inverted', 'inverted');
                    }
                    $(node).after(dupNode);
                    
                    // из первого набора условий убрать третий узел
                    var condemned = chNodes.get(2);
                    condemned.parentNode.removeChild(condemned);
                    // из второго набора удаляем второй узел
                    condemned = dupChNodes.get(1);
                    condemned.parentNode.removeChild(condemned);
                    
                    // объединить полученные узлы логикой and
                    var wrapper = tree.createElement('block');
                    wrapper.setAttribute('logic', 'and');
                    $(node).before(wrapper);
                    wrapper.appendChild(node);
                    wrapper.appendChild(dupNode);
                    
                    $(dupNode).children('block').each(function() {
                        preprocessNode(this);
                    });
                }
            }
            
            $(node).children('block').each(function() {
                preprocessNode(this);
            });
        }
        
        $('svarx > validate:first', tree).each(function() {
            preprocessNode(this);
        });
    }
    
    // Назначает валидатор на форму
    function bindHandlers(f, op) {
        function handler(e) {
            function checkPrevented(e) {
                checkPrevented.prevented = e.isDefaultPrevented();
            }
            checkPrevented.prevented = false;
            
            var validationResult = true,
                isSubmit = (e.type == 'submit'),
                $this = $(this);
            
            // в отладочном режиме безусловно предотвращаем отправку формы -
            // иначе не видно результатов отладки в случае сабмита
            if (op.debugMode && isSubmit) {
                e.preventDefault();
            }
            
            // такой метод назначения гарантирует, что обработчик
            // checkPrevented выполнится последним и мы сможем понять,
            // был ли предотвращён запуск SVARX-проверки
            $this
                .one('beforesvarx', checkPrevented)
                .trigger('beforesvarx');
            
            if (checkPrevented.prevented) {
                // не выполнять SVARX-валидацию, но запретить сабмит формы
                
                isSubmit && e.preventDefault();
                return true;
            }
            
            // препроцессинг уже можно выполнять
            preprocess(this);
            validationResult = validate(this);

            $this
               .one('aftersvarx', checkPrevented)
               .trigger('aftersvarx', [validationResult]);

            // отправку формы предотвращает провал валидации или e.preventDefault(),
            // позванный из любого обработчика aftersvarx
            if (isSubmit && (!validationResult || checkPrevented.prevented)) {
                e.preventDefault();
            }
        }        

        var $form = $(f),
            m = $.fn.svarx.methods[op.method];
            
        if (m) {
            m.before && $form.bind('beforesvarx', m.before);
            m.after && $form.bind('aftersvarx', m.after);
            m.error && $form.bind('svarxerror', m.error);
        }
        
        $form
            .unbind(op.bindTo, handler)
            .bind(op.bindTo, handler);
    }

    // Препроцессинг данных формы. Происходит на реальных значениях (не на копии).
    // Выполняется до валидации, но только в том случае, если валидация разрешена
    function preprocess(form) {
        function preprocessRule(rule) {
            var els = $(rule).attr('for').split(/\s+/),
                types = $(rule).attr('type').split(/\s+/);
            
            $.each(els, function() {
                $(form.elements[arguments[1]]).each(function() {
                    var el = this;
                    
                    if ($.fn.svarx.isTextControl(el)  // препроцессинг работает только для текстовых контролов...
                    && el.type.toLowerCase() !== 'file'  // не срабатывает на полях для загрузки файлов...
                    && !el.readOnly  // не срабатывает на readonly-полях.
                    ) {
                        $.each(types, function() {
                            ($.fn.svarx.processors[arguments[1]] || function(){})(el);
                        });
                    }
                });
            });
        }

        $('svarx > preprocess:first > rule', $(form).data('svarxXML')).each(function() {
            preprocessRule(this);
        });
    }
    
    // Главная валидирующая функция
    function validate(form) {
        // Рекурсивный обработчик правил валидации, вычисляет
        // общий логический итог проверки и расставляет на XML-дереве
        // маркеры для выполнения назначенных на ошибки действий
        function processRule(ruleNode) {
            var nodename = ruleNode.nodeName;
            
            if (nodename == 'rule') {
                var ruleCheck = applyRules(form, ruleNode);
                logicStack.push(ruleCheck);
                
                if (!ruleCheck) {
                    // ставим маркер выполнения действий для оповещения об ошибке
                    ruleNode.setAttribute('fireActs', 1);
                }
            } else if (nodename == 'block' || nodename == 'validate') {
                var childCount = $(ruleNode).children().filter(filterTags).size(),
                    logic = '&&';
    
                if (ruleNode.getAttribute('logic') == 'or') {
                    logic = '||';
                }
                
                //////////// рекурсивный вызов ///////////////////////////////
                $(ruleNode).children().filter(filterTags).each(function(){
                    processRule(this);
                });
                //////////////////////////////////////////////////////////////
                
                var tmps = [];
                for (var i = 0; i < childCount; i++) {
                    tmps.unshift(logicStack.pop());
                }
                
                var thisRuleResult = (childCount > 0) ? eval('(' + tmps.join(logic) + ')') : true;
                if (isInverted(ruleNode)) {
                    thisRuleResult = !thisRuleResult;
                }
                
                // запоминаем логический результат вычисления текущего набора правил
                logicStack.push(thisRuleResult);
                if (!thisRuleResult) {
                    // ставим маркер выполнения действий для оповещения об ошибке
                    ruleNode.setAttribute('fireActs', 1);
                }
            }
        }
        
        // Выполняет те из действий, которые соответствуют
        // реально случившимся ошибкам валидации
        function fireActions(ruleNode) {
            if (ruleNode.getAttribute('fireActs')) {
                var nodename = ruleNode.nodeName;
                if (nodename == 'rule' || nodename == 'block' || nodename == 'validate') {
                    var errCode = $(ruleNode).attr('onerror'),
                        forNode = ($(ruleNode).attr('for') || '').split(/\s+/),
                        errTargetNode = $(ruleNode).attr('errtarget');
                        
                    // экспериментальная поддержка переопределения таргета ошибки
                    if (errTargetNode !== undefined) {
                        forNode = errTargetNode.split(/\s+/);
                    }
                    
                    // вызываем ошибку только если onerror был определён
                    if (errCode !== undefined) {
                        $.each(forNode, function(ind, val) {
                            $(form.elements[val] || form).trigger('svarxerror', [errCode]);
                        });
                    }
    
                    if (nodename != 'rule') {
                        ///////// рекурсивный вызов //////////////////////////////////
                        $(ruleNode).children().filter(filterTags).each(function(){
                            fireActions(this);
                        });
                        //////////////////////////////////////////////////////////////
                    }
                }
            }
        }

        // Общий результат валидации формы и стек результатов проверок
        var result = true, logicStack = [];
        // корневой block должен быть один, но мы делаем each на случай его полного отсутствия
        $('svarx > validate:first', $(form).data('svarxXML')).each(function() {
            processRule(this);
        });
        
        result = logicStack.pop();
        
        if (!result) {
            $('svarx > validate:first', $(form).data('svarxXML')).each(function() {
                fireActions(this);
            });
            
            // очищаем все флаги, чтобы они не мешали следующей валидации
            $('*', $(form).data('svarxXML')).removeAttr('fireActs');
        }

        return result;
    }
    
    function isInverted(rule) {
        var $rule = $(rule),
            attr = $rule.attr('inverted');
        
        if (attr === undefined) {
            return false;
        }
        
        attr = attr.toLowerCase();
        return (attr == 'yes' || attr == 'inverted' || attr == '1');
    }
    
    // Внешний интерфейс
    
    // инициализация SVARX-валидации
    $.fn.svarx = function(options) {
        var op = $.extend({}, $.fn.svarx.options, options || {});
        this.filter('form').each(function() {
            var form = this,
                $form = $(form),
                pathToXML;
            
            if (op.svarxURL) {
                pathToXML = op.svarxURL;
            } else {
                var clck = this.onclick ? this.onclick() : {};
                if (clck && clck.svarxURL) {
                    pathToXML = clck.svarxURL;
                }
            }
            
            if (pathToXML === undefined) {
                return true;
            }
            
            // если метод не выбран, берём первый имеющийся
            if (op.method === undefined) {
                for (var m in $.fn.svarx.methods) {
                    op.method = m;
                    break;
                }
            }
            
            // про умолчанию назначаем Обработчик только на сабмит формы
            if (op.bindTo === undefined) {
                op.bindTo = 'submit';
            }
            
            $.ajax($.extend({
                dataType: 'xml',
                url: pathToXML,
                success: function(responseXML) {
                    $form.data('svarxXML', responseXML);  // сохраняем полученное XML-дерево
                    preprocessXML($form.data('svarxXML'));  // препроцессинг XML - разворачиваем логические условия
                    bindHandlers(form, op);  // назначаем обработчики на форму
                    op.debugMode && $form.trigger('svarxloaded', [$form.data('svarxXML')]);
                },
                error: function(xhr, status) {
                    op.debugMode && $form.trigger('svarxfailed', [xhr, status]);
                }
            }, op.jQueryAjax));
        });
        
        return this;
    };

    $.extend($.fn.svarx, {
        // версия поддерживаемого SVARX-формата
        version: 1,
        options: {
            method: undefined,  // имя плагина визуализации валидации
            debugMode: false,  // отладочный режим (всегда предотвращает сабмит формы)
            jQueryAjax: {}  // доп. параметры для jQuery.ajax запроса
        },
        isTextControl: function(el) {
            if (!el.type) {
                return false;
            } else {
                switch(el.type.toLowerCase()) {
                    case 'text':
                    case 'textarea':
                    case 'password':
                    case 'hidden':
                    case 'file':
                    case 'search':
                        return true;
                    default:
                        return false;
                }
            }
        },
        methods: {},
        rules: {
            email: function(els, rule) {
                var check = true;
                
                $(els).each(function() {
                    check = /^[a-z\d%_][a-z\d%_.&+\-]*\@([a-z\d][a-z\d\-]*\.)+[a-z]{2,10}$/i.test(this.value);
                    return check;
                });
                
                return check;
            },
        
            regexp: function(els, rule) {
                // Мы можем проверять как совпадение с полным значением (в стиле Web Forms 2.0),
                // так и по подстроке. Для этого используются разные атрибуты.
                // Если нужна подстрока, надо использовать атрибут partmatch, если полное совпадение --
                // match. Если указаны оба правила, будет проверено только match.
                
                var match = $(rule).attr('match'),
                    partMatch = $(rule).attr('partmatch'),
                    flags = $(rule).attr('flags') || '',
                    check = true,
                    re;
                    
                // RegExp поддерживает только три флага
                flags = flags.toLowerCase().replace(/[^gim]/g, '');
                
                // Т.к. в синтаксисе регулярных выражений могут быть ошибки,
                // создаём объект через try
                try {
                    if (match !== undefined) {
                        re = new RegExp('^(?:' + match + ')$', flags);
                    } else if (partMatch !== undefined) {
                        re = new RegExp(partMatch, flags);
                    } else {
                        return true;
                    }
                } catch(err) {
                    return true;
                }

                $(els).each(function() {
                    check = re.test(this.value);
                    return check;
                });
                
                return check;
            },
        
            // для радиобаттонов и чекбоксов
            checked: function(els, rule) {
                var itemIndex = $(rule).attr('item'),
                    elsCluster = {},
                    check = true;
                    
                // кластеризуем элементы по именам.
                // при этом сохраняется порядок следования элементов,
                // что позволяет внутри каждого кластера использовать поиск по itemIndex
                $(els).each(function() {
                    if (elsCluster[this.name] === undefined) {
                        elsCluster[this.name] = [];
                    }
                    
                    elsCluster[this.name].push(this);
                });
                
                // для каждого кластера проходим отдельную валидационную итерацию
                $.each(elsCluster, function(key, val) {
                    var type = val[0].type;
                    
                    if (itemIndex !== undefined) {
                        // у нас попросили валидацию для определённого элемента
                        if (val[itemIndex]) {
                            type = val[itemIndex].type;
                            val = [val[itemIndex]];
                        } else {
                            // указанного элемента нет в природе, мы должны пройти валидацию.
                            // поэтому возвращаем истину и переходим к следующей итерации.
                            // check при этом не меняется.
                            return true;
                        }
                    }
                    
                    if (type == 'checkbox' || type == 'radio') {
                        // нам не подходит дефолтное true
                        check = false;
                        // для прохождения правила ДОСТАТОЧНО ОДНОГО ПОМЕЧЕННОГО элемента
                        $(val).each(function() {
                            if (this.checked) {
                                check = true;
                                return false;  // break the loop, jQuery style
                            }
                        });
                    }
                    
                    return check;
                });
                
                return check;
            },
        
            // для селектов, одиночных и множественных
            selected: function(els, rule) {
                var item = $(rule).attr('item'),
                    check = true;
                
                $(els).each(function() {
                    var type = this.type.toLowerCase();
                    
                    if (this.selectedIndex == -1) {
                        // ни одного элемента не выбрано, правило не срабатывает
                        check = false;
                    } else if ((type == 'select-one' || type == 'select-multiple')
                    && this.options
                    && this.options.length > 0) {
                        // если мы работаем с селектом, у которого есть хоть какие-нибудь опции
                        if (item === undefined || !this.options[item]) {
                            // если не указан индекс, то правило проходит, т.к. какое-то
                            // выделение точно наличествует (проверено в первом условии).
                            // если элемента с данным номером нет, то тоже проходит по основному
                            // принципу валидации -- несуществующий элемент не может вызвать ошибки
                            return true;
                        } else {
                            // проверять на наличие this.options[item] не надо, это делается выше
                            check = !!this.options[item].selected;
                        }
                    }

                    return check;
                });
                
                return check;
            },
        
            // проверяет, что 2 или более значения полей формы
            // равны между собой (как числа или как строки);
            // также допускает проверку без учёта регистра
            eq: function(els, rule) {
                var vals = [],
                    comparison,
                    initial,
                    nocase,
                    check = true;
                
                if (els.length >= 2) {
                    for (var i = 0; i < els.length; i++) {
                        vals.push(els[i].value);
                    }
                    
                    comparison = $(rule).attr('comparison');
                    
                    switch(comparison) {
                        case 'number':
                            initial = 1 * vals[0];
                            for (var i = 1, j = vals.length; i < j; i++) {
                                if (initial !== (1 * vals[i])) {
                                    check = false;
                                    break;
                                }
                            }
                        break;
                        
                        default:  // сюда же относится case 'string'
                            nocase = $(rule).attr('nocase');
                            if (nocase !== undefined && (nocase === 'yes' || nocase === 'nocase' || nocase == 1)) {
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
                }
                return check;
            },
            
            range: function(els, rule) {
                var min = parseFloat($(rule).attr('min')),
                    max = parseFloat($(rule).attr('max')),
                    check = true;
                    
                $(els).each(function() {
                    var numVal = parseFloat(this.value);

                    if (isNaN(numVal) || (!isNaN(min) && numVal < min) || (!isNaN(max) && numVal > max)) {
                        check = false;
                    }
                    
                    return check;
                });

                return check;
            },
            
            // требует, чтобы поле было непустым.
            // работает только для текстовых полей -- для всех прочих не имеет смысла
            required: function(els, rule) {
                var check = true;
                
                $(els).each(function() {
                    if ($.fn.svarx.isTextControl(this)) {
                        check = (this.value !== '');
                    }

                    return check;
                });
                
                return check;
            }
        },
        processors: {
            parseint: function(el) {
                var tmp = parseInt(el.value, 10);
                el.value = isNaN(tmp) ? '' : tmp;
            },
            
            parsefloat: function(el) {
                var tmp = parseFloat(el.value);
                el.value = isNaN(tmp) ? '' : tmp;
            },
            
            trim: function(el) {
                el.value = el.value.replace(new RegExp(extWhiteSpace, 'g'), '');
            },
            
            normalize: function(el) {
                $.fn.svarx.processors.trim(el);
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
        }
    });
})(jQuery);
