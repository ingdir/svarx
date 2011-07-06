### jquery.update.js ###

Плагин, добавляющий в jQuery поддержку нового события **update**.

Это событие срабатывает только для текстовых контролов формы и позволяет отследить любое изменение содержимого поля, независимо от того, кем и чем оно инициировано.
Поддерживается bind/unbind, корректный event.target, event bubbling к родительским элементам.
На низком уровне работает через циклический опрос элементов с оптимизациями (автоподстройка задержек опроса, удаление/добавление элементов в зависимости от наличия подписчиков на событие, борьба с дубликатами). 

```javascript
$('input').update(function(e) {
    console.log(e.target.getAttribute('name') + ' has changed its value...');
});
```

### jquery.json2xmlDoc.js ###

Keywords: **json2xml**, **convert JSON to XML**.

Преобразует JSON-объект в XML-документ (именно в нативный Document, а не в текстовую сериализацию).
Позволяет генерировать SVARX-описания через JSON, а затем передавать их SVARX-плагину в виде:

```javascript
$('form').svarx({svarxXML: $.json2xmlDoc(my_SVARX_rules_in_JSON, 'svarx')});
```

Для описания XML следует использовать следующий формат:

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

Преобразование указанного JSON с помощью $.json2xmlDoc:

```javascript
var xml = $.json2xmlDoc(svarxJSON, 'svarx');
```

Какой XML-документ получится в итоге:

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
