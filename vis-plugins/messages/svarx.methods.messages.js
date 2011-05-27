(function($) {
    $.fn.svarx.methods.messages = {
        before: function(e) {
            // не можем лёгким способом закэшировать ссылку на внешний svarx-блок,
            // т.к. плагин может вызываться на нескольких разных формах одной страницы
            $(this)
                .closest('.b-svarx')
                .find('.b-svarx__err')
                .addClass('b-svarx__err_visible_no');
        },
        
        after: function(e, result, eType) {
            if (eType == 'submit' && !result) {
                e.preventDefault();
            }
        },
        
        error: function(e, id) {
            $(this)
                .closest('.b-svarx')
                .find('.b-svarx__err_id_' + id)
                .removeClass('b-svarx__err_visible_no');
        }
    };
})(jQuery);
