### jquery.update.js ###

This plugin add a new **update** event support to jQuery on a native level.
Compatibility: jQuery 1.4+

By default, this event occurs on form controls (inputs, textareas, select boxes) whenever the value of a field changes (compared to a previously tracked value).

You can change both the elements to be checked and the way values are determined and compared.
This allows complex scenarios from case-insensitive value tracking to monitoring page characteristics completely unrelated to form fields.

The solution is based on periodical polling; however, you can use it with event delegation, too, thus utilizing the full power of jQuery Event APIs.
The plugin takes care of removing dead/untracked elements from the polling queue, so it's relatively safe to use with dynamically changed pages.

There's a configuration API (see below).

How it works:

```javascript
$('input').update(function(e) {
    console.log(e.target.getAttribute('name') + ' has changed its value...');
});

$('form').on('update', function(e) {
    console.log(e.target.getAttribute('name') + ' has changed its value...');
});

```

Configuration API:

`$.fn.update.config()` (without arguments) returns the current configuration (as a copy!)

`$.fn.update.config(cfg)` accepts a configuration object `cfg` with the following fields (all are optional):

```javascript
var cfg = {
    // polling interval
    delay: 100,  // msec

    // how often the cache should be updated
    cacheTimeout: 2000,

    // how many elements may be queried in a polling round
    aggregateNum: 5,

    // jQuery selector to choose the elements to be polled
    elementSelector: 'input,textarea,select',

    // function to determine the value of an element;
    // accepts DOM element as a parameter
    valFn: function(el) { return $(el).val() },

    // function to determine whether two values are equal or not
    eqFn: function(oldVal, newVal) {
        return oldVal === newVal;
    }

};

$.fn.update.config(cfg);

```

`$.fn.update.reset()` resets the configuration to its default values


### jquery.json2xmlDoc.js ###

Keywords: **json2xml**, **convert JSON to XML**.

Converts a JSON into a standalone in-memory XML document (a native Document instance, not the textual serialization).
You can generate SVARX descriptions with JSON and pass them to the SVARX plugin as:

```javascript
var rules = {  /* SVARX rules in JSON */  };
$('form').svarx({svarxXML: $.json2xmlDoc(rules, 'svarx')});
```
Use the following format for SVARX rules:

```javascript
var svarxJSON = {
    "version": 2,    

    "preprocess": {
        "rule": [
            {
                "for": "email",
                "type": "trim"
            },
            {
                "for": "age",
                "type": "parseint"
            }
        ]
    },

    "validate": {
        "rule": {
            "for": "email",
            "type": "email",
            "onerror": "email_incorrect"
        }
    }
};

```

Convert your JSON with $.json2xmlDoc:

```javascript
var xml = $.json2xmlDoc(svarxJSON, 'svarx');
```

The resulting XML document:

```xml
<svarx version="2">
    <preprocess>
        <rule for="email" type="trim" />
        <rule for="age" type="parseint" />
    </preprocess>
    
    <validate>
        <rule for="email" type="email" onerror="email_incorrect" />
    </validate>
</svarx>
```

Enjoy!