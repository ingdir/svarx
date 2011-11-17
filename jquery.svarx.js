/**
 *
 * @author         Max A. Shirshin (ingdir@yandex-team.ru)
 * @version        2.41
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
        TAG_PREPROCESS = 'preprocess',
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
        var result = [];

        if (!root) return result;

        var i = 0,
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

    // Some browsers do not provide getElementById() on XML docs.
    // So this func extracts node by its id, using "root" node as
    // the beginning of the lookup.
    //
    // if root is null, return null.
    //
    // if no id is provided, return root.
    //
    function byId(id, root) {
        if (!root || !id) return null;

        var tagNames = [TAG_BLOCK, TAG_RULE];

        // yes, root can have id, too
        if (root.getAttribute('id') === id) {
            return root;
        } else {
            for (var t = 0, n = tagNames.length;  t < n; t++) {
                for (var i = 0, tags = root.getElementsByTagName(tagNames[t]), j = tags.length; i < j; i++) {
                    if (tags[i].getAttribute('id') === id) {
                        return tags[i];
                    }
                }
            }

            return null;
        }
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
                    // which, we believe, never evaluates to false)
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
                
                /* Special case: the rule does not request any elements at all.
                   These rules get passed a full set of form elements as an argument.
                
                   Neither SVARX.nonEmpty() nor ATTR_FAIL_IF_NULL are considered.
                */
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

            // We have to optimize (pre-process) our XML.
            function preprocessXML() {
                // invert the meaning of an attribute
                function invertNode(node) {
                    $.each([ATTR_INVERTED, ATTR_FAIL_IF_NULL], function(i, attr) {
                        if (isAttrTrue(node, attr)) {
                            node.removeAttribute(attr);
                        } else {
                            node.setAttribute(attr, attr);
                        }
                    });
                }
                
                // unwrap "if" blocks using logic A → B ↔ ~A | B
                function unwrapIfThenElse(node) {
                    if (node.getAttribute(ATTR_LOGIC) === 'if') {
                        var chNodes = filterTags(node, TAG_RULE, TAG_BLOCK);
                        
                        // if..then or if..then..else
                        if (chNodes.length == 2 || chNodes.length == 3) {
                            node.setAttribute(ATTR_LOGIC, 'or');
                            invertNode(chNodes[0]);
                        }
                        
                        // additional processing for "if..then..else" case
                        if (chNodes.length == 3) {
                            var dupNode = node.cloneNode(true),
                                dupChNodes = filterTags(dupNode, TAG_RULE, TAG_BLOCK);
                                
                            invertNode(dupChNodes[0]);
                            dupNode = node.parentNode.insertBefore(dupNode, node.nextSibling);
                            
                            // remove the third node from the first set of conditions
                            var condemned = chNodes[2];
                            condemned.parentNode.removeChild(condemned);
                            // remove the second node from the second rule set
                            condemned = dupChNodes[1];
                            condemned.parentNode.removeChild(condemned);
                            
                            // combine the extracted nodes with "and" logic
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

                // here we count how many elements the rule expects to process,
                // so later we can see if everything was actually found
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

            // unbind all event handlers related to svarx
            function unbindHandlers() {
                $form.unbind(eventNameSpace);
            }
            
            // assign validation to a form
            function bindHandlers() {
                // the handler that gets assigned
                function handler(e) {
                    var validationResult = true,
                        wasPrevented = false,
                        validateBlockId = op.validateBlockId,
                        validateBlockIdDefined = 'validateBlockId' in op,
                        preprocessBlockId = op.preprocessBlockId,
                        preprocessBlockIdDefined = 'preprocessBlockId' in op,
                        checkPrevented = function(e) {
                            wasPrevented = e.isDefaultPrevented();
                        };

                    /*

                    If one has to use a subtree of the existing SVARX document for
                    validation, that can be done either statically by specifying
                    "validateBlockId" and "preprocessBlockId" field in options, or dynamically.

                    Dynamic case has precedence over static definition in options.

                    Pass object containing "validateBlockId" and "preprocessBlockId" fields
                    as the LAST argument to the validation event handler when triggering it.

                    If one of the fields is omitted, use main root preprocess or validate block.

                    $('some.selector')
                        .trigger('eventName', [arg1, arg2, ...,
                            {validateBlockId: "myUniqueId", preprocessBlockId: "myUniqueId2" }
                        ]);

                    */
                    
                    if (arguments.length > 1) {
                        // we have to temporary convert argument to an Object to be able
                        // to check for a property on non-object elements (such as null, boolean) safely
                        var argLast = Object(arguments[arguments.length - 1]);

                        if ('validateBlockId' in argLast) {
                            validateBlockId = argLast.validateBlockId;
                            validateBlockIdDefined = true;
                        }

                        if ('preprocessBlockId' in argLast) {
                            preprocessBlockId = argLast.preprocessBlockId;
                            preprocessBlockIdDefined = true;
                        }

                    }

                    // This way we guarantee that "checkPrevented" will be executed last
                    // and we will be able to find if the event was prevented  by earlier handlers.
                    // If it was, we must stop SVARX validation.
                    $form
                        .one('beforesvarx', checkPrevented)
                        .trigger('beforesvarx', [e.type]);
                    
                    if (wasPrevented) {
                        // DO NOT run SVARX validation, DO NOT prevent event
                        return true;
                    }
                    
                    // drop form element cache (unless form was marked as immutable in options)
                    op.immutable || resetElsCaches();
                    // we can start preprocessing now
                    preprocessBlockIdDefined ? preprocess(preprocessBlockId) : preprocess();
                    validationResult = validateBlockIdDefined ? validate(e.type, validateBlockId) : validate(e.type);
                    
                    $form
                       .one('aftersvarx', checkPrevented)
                       .trigger('aftersvarx', [validationResult, e.type]);
        
                    // if any 'aftersvarx' event handler called e.preventDefault(),
                    // this also means we have to prevent current event
                    wasPrevented && e.preventDefault();
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


            // Form values are preprocessed according to SVARX rules.
            // This happens on real DOM elements, so there are some side effects in IE
            // related to cursor position not restored correctly.
            // Preprocessing happens before validation, and does not happen if validation was prevented.
            function preprocess() {
                function preprocessRule(ruleNode) {
                    if (!ruleNode) return false;

                    switch(ruleNode.nodeName) {
                        case TAG_BLOCK:
                        case TAG_PREPROCESS:
                            var ch = filterTags(ruleNode, TAG_RULE, TAG_BLOCK);

                            for (var i = 0, j = ch.length; i < j; i++) {
                                // recursive call
                                preprocessRule(ch[i]);
                            }
                        break;

                        case TAG_RULE:
                            var type = ruleNode.getAttribute('type');

                            type && $ruleEls(ruleNode).each(function(i, el) {
                                if (SVARX.isTextControl(el)  // preprocessing works with text-based controls only...
                                && el.type.toLowerCase() !== 'file'  // file upload controls are skipped...
                                && !el.readOnly) { // ...readonly fields are skipped
                                    // ...disabled fields were skipped earlier in $elsByRule(..)
                                    (SVARX.processors[type] || SVARX.unknownPreprocessFactory(type))(el, ruleAsJSON(ruleNode));
                                }
                            });
                        break;
                    }
                }

                var preprocessNode = filterTags(op.svarxXML.documentElement, TAG_PREPROCESS)[0] || null,
                    // if preprocessBlockId is passed, even as null or undefined, use it;
                    // otherwise, start from the root node
                    startNode = arguments.length > 0 ? byId(arguments[0], preprocessNode) : preprocessNode;

                preprocessRule(startNode);
            }

            // main validating func
            function validate(eventType) {
                // Recursive validation rule processor, produces final validation result
                // by recursive iteration over the XML tree.
                // Attaches markers directly to XML tree according with found errors
                function processRule(ruleNode) {
                    if (!ruleNode) return false;
                    
                    switch (ruleNode.nodeName) {
                        case TAG_RULE:
                            var ruleCheck = applyRule(ruleNode);
                            logicStack.push(ruleCheck);
                        
                            if (!ruleCheck) {
                                // attach a marker that means "fire error here"
                                ruleNode.setAttribute(ATTR_FIRE_ACTS, 1);
                            }
        
                        break;
        
                        case TAG_BLOCK:
                        case TAG_VALIDATE:
                            var ch = filterTags(ruleNode, TAG_RULE, TAG_BLOCK),
                                childCount = ch.length,
                                logic = ruleNode.getAttribute(ATTR_LOGIC) == 'or' ? '||' : '&&';
        
                                for (var i = 0; i < childCount; i++) {
                                    // recursive call
                                    processRule(ch[i]);
                                }
                        
                            var tmps = [];
                            for (var i = 0; i < childCount; i++) {
                                tmps.unshift(logicStack.pop());
                            }
                        
                            var thisRuleResult = (childCount > 0) ? (new Function('return (' + tmps.join(logic) + ')'))() : true;
                            if (childCount > 0 && isAttrTrue(ruleNode, ATTR_INVERTED)) {
                                thisRuleResult = !thisRuleResult;
                            }
                            
                            // store current result
                            logicStack.push(thisRuleResult);
                            if (!thisRuleResult) {
                                // attach a marker that means "fire error here"
                                ruleNode.setAttribute(ATTR_FIRE_ACTS, 1);
                            }
        
                        break;
                    }
                }
                
                // Run actions that correspond to actually happened errors
                function fireActions(ruleNode) {
                    if (!ruleNode || !ruleNode.getAttribute(ATTR_FIRE_ACTS)) return false;
                    ruleNode.removeAttribute(ATTR_FIRE_ACTS);
                    
                    switch(ruleNode.nodeName) {
                        case TAG_RULE:
                        case TAG_BLOCK:
                        case TAG_VALIDATE:
                            var errCode = ruleNode.getAttribute('onerror');

                            // cannot run error handler without onerror attribute present and non-empty
                            if (errCode) {
                                // allow error target to be redefined
                                $targetEls(ruleNode).trigger('svarxerror', [
                                    errCode,
                                    eventType,
                                    ruleAsJSON(ruleNode)
                                ]);
                            }

                            if (ruleNode.nodeName !== TAG_RULE) {
                                // recursive call
                                for (var i = 0, ch = filterTags(ruleNode, TAG_BLOCK, TAG_RULE), j = ch.length; i < j; i++) {
                                    fireActions(ch[i]);
                                }
                            }

                        break;
                    }
                }
        
                // Cumulative result of form validation and stack
                // that contains intermediate validation results
                var result = true,
                    logicStack = [],
                    validateNode = filterTags(op.svarxXML.documentElement, TAG_VALIDATE)[0] || null,
                    // if validateBlockId is passed, even as null or undefined, use it;
                    // otherwise, start from the root node.
                    startNode = arguments.length > 1 ? byId(arguments[1], validateNode) : validateNode;

                processRule(startNode);
                
                // when validating against an empty rule set, result still remains true
                if (logicStack.length > 0) result = logicStack.pop();
                !result && fireActions(startNode);
                
                return result;
            }

            function cloneXML(doc) {
                var emptyXMLDoc = window.ActiveXObject ?
                    new ActiveXObject('Msxml2.DOMDocument.3.0') :
                    document.implementation.createDocument('', '', null);

                emptyXMLDoc.appendChild(doc.documentElement.cloneNode(true));
                return emptyXMLDoc;
            }
            
            function init() {
                preprocessXML();  // XML preprocessing to unwrap some logical blocks
                bindHandlers();  // assign handlers to a form
                $form.trigger('svarxloaded', [cloneXML(op.svarxXML), op]);
            }
            
            var op = $.extend({}, SVARX.options, options || {}),
                form = this,
                $form = $(form);
            
            // if no error visualization method specified,
            // use the first one available
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
        // library version
        version: 2.41,
        options: {
            method: undefined,  // default error visualization plugin
            bindTo: 'submit',  // the event name to bind the validation to (can be redefined)
            jQueryAjax: {}  // additional parameters for jQuery.ajax request
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
                
                // these are text-like, so consider then textual
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
            //
            // DEPRECATED, use user-defined rules instead.
            //
            // "email" rule will be removed from default rule set.
            // Since no one actually uses or wants RFC-based regexp validation,
            // there's no point in providing any kind of simplified regexp.
            // Most web services have additional restrictions on email validation.
            //
            // This rule must always be a custom rule. Maybe I'll move it to a separate file,
            // to be included by anybody who just wants to "occasionally validate some emails" :-)
            //
            email: function(els) {
                return /^[a-z\d%_][a-z\d%_.&+\-]*\@([a-z\d][a-z\d\-]*\.)+[a-z]{2,10}$/i.test(els[0].value);
            },
        
            regexp: function(els, rule) {
                // We may need a full match (a-la Web Forms 2.0),
                // or a substring match. To distinguish between these two cases,
                // we use different attributes to specify the regexp itself.
                // When regexp comes in "partmatch" attribute, we're looking for a substring match;
                // otherwise, regexp is specified in the "match" attribute.
                //
                // When both attributes are provided, "match" has a precedence.
                
                var match = rule.match,
                    partMatch = rule.partmatch,
                    flags = rule.flags || '',
                    el = els[0],
                    re,
                    execResult;
                    
                // RegExp constructor suports only 3 flags,
                // but "g" is meaningless for us, and even harmful.
                // So we accept "i" and "m" only.
                flags = flags.toLowerCase().replace(/[^im]/g, '');
                
                // RegExp constructor may throw errors on incorrect syntax,
                // and since external files are always error-prone,
                // we take advantage of try {...} catch {...} :-)
                try {
                    if (match) {
                        re = new RegExp(match, flags);
                        execResult = re.exec(el.value);

                        // To me it looks, so far, the easiest way to make sure
                        // we have a full-string match:
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
        
            // for radio buttons and checkboxes
            checked: function(els) {
                var type = els[0].type.toLowerCase();
                
                if (type === 'checkbox' || type === 'radio') {
                    return !!els[0].checked;
                } else return true;
            },
        
            // for select-boxes, single and multiple ones
            selected: function(els, rule) {
                var option = parseInt(rule.option, 10),
                    el = els[0],
                    type = el.type.toLowerCase();
                
                if (type !== 'select-one' && type !== 'select-multiple') {
                    return true;
                }
                
                if (el.selectedIndex === -1) {
                    // no elements selected, the rule cannot proceed and returns true
                    return false;
                }
                
                if (isNaN(option)) {
                    // if the select element is "select-one", then some options is already specified.
                    //
                    // if it is "select-multiple", and we didn't return on a previous step,
                    // then selectedIndex is greater than -1, some of the options is chosen
                    // and the rule passes.
                    return true;
                }

                if (!el.options[option]) {
                    // if an "option" is specified but does not exist,
                    // it cannot be selected, and the rule fails.
                    return false;
                }
                
                // el.options[option] exists, see above
                return !!el.options[option].selected;
            },
        
            // check that 2 or more form fields
            // have equal values (compared either as strings, or as float numbers);
            //
            // case-insensitive check is supported too
            //
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

                return !(isNaN(numVal) || (!isNaN(min) && numVal < min) || (!isNaN(max) && numVal > max));
            },
            
            // check that field is empty.
            // works for textual fields only;
            // for all other types it is meaningless and therefore evals to true
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
