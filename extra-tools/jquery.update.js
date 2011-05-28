/**
 * Плагин для отслеживания любых изменений на текстовых элементах форм.
 *
 * (c) Max Shirshin и компания Яндекс, http://www.yandex.ru
 *
 */

(function ($, undefined) {
    var eventName = 'update',
        
        // ключи для .data(), на которых храним специфические свойства
        dataKey = 'update:prev',
        isTracked = 'update:istracked',
        
        // селектор, по которому выбираем элементы, на которых будем отслеживать
        // событие обновления значения, т.е. которые будем поллить в реальном
        // времени
        elementSelector = 'input[type=text],input[type=search],input[type=hidden],textarea',
        timeoutId,
        
        // jQuery-объект для хранения списка элементов, которые поллим
        $inputs,

        // инициализируем счётчик обхода списка объектов поллинга
        counter = -1,

        // сколько элементов мы уже обошли в рамках 1 цикла поллинга
        aggregated = 0;

    // Фция-поллер
    function poll(mozDelay) {
        // Выполняем один цикл аггрегированного поллинга.
        //
        // Не закладываемся слепо на aggregateNum, т.к. его нет смысла делать больше,
        // чем число элементов в полл-пуле
        // 
        while (++aggregated <= Math.min($inputs.size(), $.fn[eventName].aggregateNum)) {
            // Эта строчка обеспечивает зацикливание обхода и сброс в ноль, если дошли до конца
            // или нужный элемент не найден (удалён из документа или отфильтрован нами же
            var el = $inputs.get(++counter) || $inputs.get(counter = 0);
            if (el) {
                //@debug console.log(el, new Date().getTime());
                processEvent.call(el);
            }
        }
        
        // В Mozilla на вход первым аргументом придёт задержка выполнения
        // в миллисекундах. Наличие такой задержки -- тревожный симптом,
        // и когда она достигает половины нашего собственного интервала поллинга,
        // мы откладываем следующее выполнение на бОльшее время
        aggregated = 0;
        timeoutId = setTimeout(poll, $.fn[eventName].delay + (mozDelay > $.fn[eventName].delay/2 ? mozDelay : 0));
    }
    
    // смотрим, изменилось ли значение элемента
    function processEvent() {
        var el = this,
            cachedVal = $.data(el, dataKey);

        if (cachedVal === undefined) {
            // first run, cache value
            $.data(el, dataKey, el.value);
        } else if (cachedVal !== el.value) {
            $(el)
                .data(dataKey, el.value)
                .trigger(eventName);
        }
    }

    // классический шорткат-обёртка, как у прочих событий
    $.fn[eventName] = function(fn) {
        return fn ? this.bind(eventName, fn) : this.trigger(eventName);
    };
    // интервал поллинга элементов
    $.fn[eventName].delay = 100;  // msec
    // сколько элементов можно поллить одновременно за 1 проход
    $.fn[eventName].aggregateNum = 5;
  
    $.event.special[eventName] = {
        // один раз для каждого уникального DOM-элемента
        setup: function() {
            var $this = $(this),
                $newElems = $this
                    .find(elementSelector)    // раз...
                    .andSelf()                // два...
                    .filter(elementSelector); // три => спец.магия для выборки в стиле "текущий + все потомки"
                    
                $newElems.each(function() {
                    $.data(this, dataKey, this.value);
                        
                    // скольким фциям-слушателям интересно поллить этот объект
                    //
                    // когда число заинтересованных станет 0, элемент можно будет
                    // удалить из поллинг-пула
                    // 
                    var trackedNum = $.data(this, isTracked) || 0;
                    $.data(this, isTracked, trackedNum + 1);
                });
            
            // добавляем элементы к списку для поллинга, jQuery обеспечивает их уникальность
            $inputs = $inputs ? $inputs.add($newElems) : $newElems;
            // запускаем поллинг
            (timeoutId !== undefined) || poll();
        },
        teardown: function() {
            if ($inputs) {
                var $this = $(this),
                    // смотрим, какие элементы поллятся для выбранного DOM-элемента.
                    // может поллиться либо сам элемент, либо его потомки (если мы использовали
                    // делегирование событий при bind)
                    $trackedElems = $this
                        .find(elementSelector)
                        .andSelf()
                        .filter(elementSelector);
                
                // для всех участников поллинга мы уменьшаем на 1 число заинтересованных в поллинге
                $trackedElems.each(function() {
                    var currentTrackedNum = $.data(this, isTracked) || 0;
                    $.data(this, isTracked, Math.max(currentTrackedNum - 1, 0));
                });

                $inputs = $inputs.not(this).filter(function() {
                    //@debug console.log($.data(this, isTracked));
                    
                    // элемент подходит, если у него есть хотя бы 1 заинтересованный слушатель
                    return $.data(this, isTracked) > 0;
                });

                $this
                    .removeData(dataKey)
                    .removeData(isTracked);

                // если поллить больше некого, поллинг надо остановить
                if ($inputs.size() == 0) {
                    (timeoutId !== undefined) && clearTimeout(timeoutId);
                    timeoutId = undefined;
                }
            }
        }
    };

})(jQuery);