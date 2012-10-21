/**
 * JSON to XML Document jQuery plugin.
 *
 * Derived from json2xml jQuery plugin by Michal Korecki, www.michalkorecki.com.
 * However, this is neither fork nor patch.
 *
 * $.json2xml by Michal returns XML strings but $.json2xmlDoc returns native XML Documents,
 * and does not provide configuration options (yet?).
 *
 * The main purpose of this plugin is to facilitate easy conversion from JSON to XML
 * so that SVARX validation rulesets can be generated client-side from JSON data.
 *
 * @version 1.00
 * @author Max Shirshin, based on code by Michal Korecki
 *
 */
(function($) {
    /**
     * Convert JSON object to XML Document.
     *
     * @param JSON object (not JSON string!)
     * @param root tag name for XML document tree
     * @return XML Document
     */
    $.json2xmlDoc = function(json, tagName) {
        var xmlDoc;
        
        try {
            xmlDoc = document.implementation.createDocument('', '', null);
        } catch(e) {
            xmlDoc = new ActiveXObject('Msxml2.DOMDocument.3.0');
        }

        try {
            convertToXml(xmlDoc, json, tagName);
        } catch(e) {
            throw new Error('JSON to XML conversion failed: ' + e.message);
        }

        return xmlDoc;
    };

    function convertToXml(root, json, tagName) {
        var doc = root.ownerDocument || root,
            newTag = root.appendChild( doc.createElement(tagName) );

        for (var key in json) {
            if (json.hasOwnProperty(key)) {
                if ($.isArray(json[key])) {
                    createNodeFromArray(newTag, json[key], key);
                } else if (typeof json[key] === 'object') {
                    convertToXml(newTag, json[key], key);
                } else {
                    newTag.setAttribute(key, json[key]);
                }
            }
        }
    }

    function createNodeFromArray(root, source, name) {
        if (source.length > 0) {
            for (var index in source) {
                if (typeof source[index] !== 'object') {
                    if (source[index] === '') {
                        root.appendChild( root.ownerDocument.createElement(name) );
                    } else {
                        root.appendChild( root.ownerDocument.createElement(name) )
                            .appendChild( root.ownerDocument.createTextNode(source[index]) );
                    }
                } else {
                    convertToXml(root, source[index], name);
                }                    
            }
        } else {
            root.appendChild( root.ownerDocument.createElement(name) );
        }
    }

})(jQuery);