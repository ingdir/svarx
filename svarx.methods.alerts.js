(function($) {
    var msg = '',
        err;
    
    $.fn.svarx.methods.alerts = {
        before: function() {
            msg = '';
            err = $(this).data('ERRORS') || {};
        },
        after: function() {
            window.alert(msg);
        },
        error: function(e, id) {
            if (err[id] !== undefined) {
                msg += err[id] + '\n';
            } else {
                msg += 'Error ' + id + ' occured\n';
            }
        }
    };
})(jQuery);
