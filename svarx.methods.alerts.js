(function($) {
    var msg = '',
        err;
    
    $.fn.svarx.methods.alerts = {
        before: function() {
            msg = '';
            err = $.fn.svarx.methods.alerts.txt;
        },
        after: function(e, isValid, eType) {
            if (!isValid) {
                window.alert(msg);
                if (eType == 'submit') {
                    e.preventDefault();
                }
            }
        },
        error: function(e, id) {
            if (err[id] !== undefined) {
                msg += err[id] + '\n';
            } else {
                msg += 'Error ' + id + ' occurred\n';
            }
        },
        txt: {}
    };
})(jQuery);
