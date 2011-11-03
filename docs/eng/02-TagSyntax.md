### Tag list ###
#### validate ####
This is a block-level tag that contains all validation rules.
Basic rules are described by `<rule>` tags; rule sets and conditional validation are formed with the help of `<block>` tags.

Each time before validation starts, form field values are preprocessed using rules listed in `<preprocess/>` section (see below).

You can store more than one `<validate/>` block in a single SVARX file; in this case, add a non-empty **id** attribute to each of your **validate** blocks and pass **validateBlockId** parameter to the jQuery plugin with the corresponding id.

#### rule ####
The `<rule>` tag can be self-closing (short form) which is used mostly to describe validation rule for a single field, or act as a block-level container (full form) to describe validation for more than one field.

##### rule — short notation #####
**Mandatory** attribute:

* **type** — specify validation type here

**Optional** attributes which can be used with any `<rule>` tag regardless of validation type it defines:

* **for** — the name of a form field to apply the rule to; if not specified, all existing form elements are passed to a validation function. Omitting this attribute is an effective way to describe user defined data-independent validation rules.
* **item** — a zero-based index of an element in case you have more than one form element with the same name.
* **onerror** — error id, the "name" of error that identifies this particular rule; error handlers will get this id and use it to present the error to the user. Since this id may be used to bind visualization with error data, it can become an HTML class name, file name etc., so it's not recommended to use anything except Latin letters and digits to create these ids.
* **errtarget** — the name of a form field that becomes responsible for the error on the presentation layer, also the target element of SVARX error handler when it is called. By default, this value is the same as specified in the **for** attribute, but you can redefine this. Useful for complex forms where actual validated fields and not always the fields that explain validation errors to the user. For example, you may have a field to input the phone number and parse it dynamically into country code, city code, and local number, placing each of them into a separate hidden input. You may want to validate hidden inputs but provide error message (red highlight etc.) on the original field, which would be an *errtarget** in this case.  
* **errtargetitem** — аналог атрибута **item**, но относится к **errtarget**. Для случая, когда указан **errtarget** и в форме есть несколько элементов с подобным именем, использование **errtargetitem** позволяет указать номер элемента. Нумерация с нуля.
* **inverted="yes|no"** — логическое **not** для правила, меняющее результат проверки на противоположный

Прочие атрибуты тега `<rule>` зависят от указанного типа проверки.

##### Полная форма тега rule #####
Тег `<rule>` в полной форме является контейнером, у которого могут быть вложенные элементы.
Атрибуты **for**, **item**, **errtarget**, **errtargetitem** в полной форме записи не используются, вместо них в контейнер тега `<rule>` добавляются вложенные теги:

* &lt;el /&gt; — аналог атрибута **for** из краткой формы, используется для указания элемента, с которым связано правило
* &lt;errtarget /&gt; — аналог атрибута **errtarget**

Теги &lt;el&gt; и &lt;errtarget&gt; имеют атрибут **name** для указания имени элемента формы, и опциональный атрибут **item** (аналог атрибутов **item** и **errtargetitem** из краткой формы записи). Семантика остаётся та же самая, но для правил, проверяющих более одного поля (например, проверка равенства двух полей), можно перечислить все эти поля, чего нельзя сделать в краткой записи. Теоретически, можно всегда пользоваться полной формой, но результирующий XML получится более объёмным.
У тега &lt;errtarget&gt; можно использовать атрибут **alias**, который может принимать одно из двух значений: **form** и **children**.
В первом случае, ошибка возникает на самой форме (на DOM-элементе формы), а во втором — на всех элементах, соотнесённых с дочерними правилами `<rule>` текущего блока (и, таким образом, имеет смысл только на кумулятивных правилах).
При этом вложенные теги `<block>` игнорируются, однако переопределения errtarget у правил учитываются.
То есть, в приведённом ниже примере

```xml
<block onerror="epic_fail">
    <errtarget alias="children" />
    
    <rule for="login" type="email" />
    <rule for="password" type="regexp" match="[0-9a-z]+" flags="i" errtarget="password2" />

    <block onerror="login_fail">
        <rule for="login" type="regexp" partmatch="^[a-z]" />
        <rule for="login" type="regexp" partmatch="[a-z]$" />
    </block>
</block>
```
ошибка с идентификатором **epic_fail** будет проассоциирована с элементами формы **login** и **password2**.

Прочие атрибуты тега `<rule>` в полной форме, как и в краткой, зависят от указанного типа проверки.

По умолчанию все правила в блоке &lt;validate&gt; связаны логикой AND, т.е. форма считается безошибочной, если ни одно правило не вызвало ошибки.

Правила `<rule>` можно объединять в семантические блоки `<block>`. У `<block>` нет обязательных атрибутов, но есть опциональные:

* **logic="and|or|if"** — логика объединения вложенных правил <rule> (по умолчанию — and). Значение **if** имеет особую семантику, о ней ниже.
* **onerror**  — идентификатор ошибки, которая будет вызвана в случае, если проверка блока провалилась.
* **errtarget**, **errtargetitem** — см. выше. Этот атрибут особенно полезен именно для `<block>`, т.к. он семантически не привязан ни к одному полю формы, а это не всегда хорошо.
* **inverted="yes|no"**  — аналогично <rule>, но меняет логическое значение результата блока целиком 

У тега `<block>`, так же как и у тега `<rule>`, есть полная форма записи (выше описана именно краткая). Полная форма отличается тем, что запрещает использование атрибутов **errtarget** B **errtargetitem**, но разрешает использование вложенных тегов &lt;errtarget&gt;, аналогично полной форме записи тега `<rule>`.

Блоки можно неограниченно вкладывать друг в друга.

Блок с logic="if" ведёт себя особым образом: он эмулирует поведение стандартного "if..then..else". У такого блока должно быть не менее двух потомков (ими могут быть другие `<block>` или `<rule>`). Первый считается условием (аналог IF), второй блок (аналог THEN) вступает в силу (т.е. учитывается при валидации) только тогда, когда первый блок при проверке истинен. Опциональный третий блок (аналог ELSE) вступает в силу тогда, когда первый блок даёт при проверке ложный результат.

Пример:

```xml
<block logic="if">
    <!--  Если поле login не является адресом e-mail, то... -->
    <rule for="login" type="email" inverted="yes" />
    <!--  ...считать ошибкой, если оно начинается с цифры: -->
    <rule for="login" type="regexp" partmatch="^\d" inverted="yes" onerror="login_start_digit" />
</block>
```

Атрибуты onerror на первом элементе условного блока (аналоге IF) и на самом &lt;block logic=&quot;if&quot;&gt; ведут себя не так, как (вероятно) ожидает пользователь, поэтому на этих блоках указывать их не рекомендуется. Возможно, в будущем эта рекомендация станет правилом. Чтобы обработать результат проверки условного блока, используйте обработчики onerror на блоках THEN или ELSE.

#### Блок preprocess ####
В этом блоке перечисляются правила предварительной обработки значений полей. Каждое правило имеет синтаксис, аналогичный синтаксису тегов `<rule>`, но при этом не рассматриваются атрибуты **errtarget** и **errtargetitem**.


```xml
<rule
    for="имя поля"
    type="тип препроцессинга"
/>

```
Объединение правил в блоки не используется, но можно задавать несколько полей с использованием расширенного синтаксиса тега `<rule>` (см. соответствующий раздел).

Препроцессинг выполняется с соблюдением указанного порядка полей и обработок.
Неизвестные типы обработок игнорируются.

Препроцессинг **не выполняется**:

* **Для любых не-текстовых контролов** (т.е. чекбоксы, радиобаттоны, селекты не обрабатываются)
* Для полей типа "file" (попытка изменения значений на таких полях выдаёт security error)
* Для полей, отмеченных как readonly (спорное место, реализация может измениться)

Пример:

```xml
<preprocess>
    <rule for="iname" type="trim" />
    <rule for="bday" type="parseint" />
</preprocess>

```

Внутри одного svarx-файла можно хранить несколько блоков &lt;preprocess&gt;. В этом случае нужно каждому из них указывать уникальный идентификатор через атрибут **id**.
По умолчанию будет использован первый по порядку блок, но при инцииализации jQuery-SVARX-плагина в опциях можно передать ключ **preprocessBlockId**, и в этом случае будет использован блок с соответствующим **id**.
