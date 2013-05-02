/**
 *
 * @author Max Shirshin
 * @description Plugin to track any type of change on any element, with jQuery "native" event API, based on polling
 * @version 2.0
 *
 */

(function ($, undefined) {
    var eventName = 'update',
        
        // keys for .data() to associate some internal properties with
        valueCache = 'update:prev',
        
        timeoutId,
        cacheTimeoutId,
        
        // jQuery object to store the polled elements
        $pool = $(),

        // jQuery object to store the original elements the handlers are attached to
        $source = $(),

        // initialize the polling counter
        counter = -1,

        // how many elements were polled in a polling round
        aggregated = 0,

        // default options
        cfg = {},
        defaults = {
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

    // polling function
    function poll() {
        // one round of aggregated polling
        //
        // aggregateNum may still be more than the actual number of elements to poll,
        // thus an extra check
        while (++aggregated <= Math.min($pool.length, cfg.aggregateNum)) {
            var el = $pool.get(++counter) || $pool.get(counter = 0);
            if (el) {
                processEvent(el);
            }
        }

        aggregated = 0;
        timeoutId = setTimeout(poll, cfg.delay);
    }
    
    // check whether the actual value has changed
    function processEvent(el) {
        var cachedVal = $.data(el, valueCache),
            val = cfg.valFn(el);

        if (cachedVal === undefined || cfg.eqFn(cachedVal, val)) {
            // cache value
            $.data(el, valueCache, val);
        } else if (! cfg.eqFn(cachedVal, val)) {
            $(el)
                .data(valueCache, val)
                .trigger(eventName);
        }
    }

    function refreshCache() {
        // empty the polling pool
        $pool = $();
        // filter out dead elements
        $source = $source
            .filter(function() {
                // elements removed from DOM shouldn't be polled anymore
                return $.contains(document.documentElement, this);
            })
            .each(function() {
                addToPolling(this);
            });

        // schedule next run
        cacheTimeoutId = setTimeout(refreshCache, cfg.cacheTimeout);

        if ($pool.length === 0 && $source.length === 0) {
            clearTimeout(timeoutId);
            clearTimeout(cacheTimeoutId);
            timeoutId = cacheTimeoutId = undefined;
        }
    }
    
    function addToPolling(el) {
        // add elements to the polling list, jQuery cares for the uniqueness
        $pool = $pool.add($getPolled(el));
    }

    // see which elements are being polled for this element.
    // it can either be the element itself or its descendants (if event delegation was used)
    function $getPolled(el) {
        var $el = $(el);

        return $el
            .find(cfg.elementSelector)
            .add( $el.filter(cfg.elementSelector) );
    }

    // provide a wrapper function similar to other events
    $.fn[eventName] = function(fn) {
        return fn ? this.bind(eventName, fn) : this.trigger(eventName);
    };

    // define API
    $.extend($.fn[eventName], {
        config: function(c) {
            if (c) {
                $.extend(cfg, c);
            } else {
                return $.extend({}, cfg);
            }
        },

        reset: function() {
            $.extend(cfg, defaults);
        },

        debug: function() {
            return [$pool, $source];
        }
    });

    // initialize default config
    $.fn[eventName].reset();

    $.event.special[eventName] = {

        setup: function() {
            $source = $source.add(this);
            addToPolling(this);
        },

        add: function() {
            // start polling
            timeoutId || poll();
            // start refreshing cache periodically
            cacheTimeoutId || refreshCache();
        },

        remove: function() {
            clearTimeout(cacheTimeoutId);
            refreshCache();
        },

        teardown: function() {
            $source = $source.not(this);
            // this is the last event handler for this element, so we remove .data() properties
            $(this).removeData(valueCache);
        }
    };

})(jQuery);
