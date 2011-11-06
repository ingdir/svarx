(function($) {
    function assert() {
        var errorsFact = $.map(
            d.msg,
            function(el) {return el.id}
        ).sort().join('#'),
            errorsExpected = d.expect.msg.sort().join('#');
        
        console.assert(errorsFact === errorsExpected);
        console.assert(d.isValid === d.expect.isValid);
        console.log(errorsFact, '- FACT');
        console.log(errorsExpected, '- EXPECTED');
    }
    
    var d = $.fn.svarx.methods.debug = {
        before: function() {
            console.time('Validation');
            d.msg = [];
        },
        after: function(e, isValid, eventType) {
            console.timeEnd('Validation');
            d.isValid = isValid;
            assert();
            
            // this is debug!!
            e.preventDefault();
        },
        error: function(e, id) {
            var r = {
                id: id,
                target: e.target
            };
            console.log('Error ', id, ' on ', e.target);
            d.msg.push(r);
        },
        
        // debug
        msg: [],
        isValid: true,
        expect: []
    };
})(jQuery);
