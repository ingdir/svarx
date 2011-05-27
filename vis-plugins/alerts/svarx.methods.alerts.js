(function($, undefined) {
    $.fn.svarx.methods.alerts = {
        before: function() {
            $(this).data('errorMessage', '');
        },

        after: function(e, isValid, eType) {
            if (!isValid) {
                alert( $(this).data('errorMessage') );

                if (eType == 'submit') {
                    e.preventDefault();
                }
            }
        },

        error: function(e, id) {
            var $this = $(this),
                oldMsg = $this.data('errorMessage');

            if (window.ERRORS && window.ERRORS[id] !== undefined) {
                $this.data('errorMessage', oldMsg + window.ERRORS[id] + '\n');
            } else {
                $this.data('errorMessage', oldMsg + 'Error ' + id + '\n');
            }
        }
    };
})(jQuery);
