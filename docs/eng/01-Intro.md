### What is SVARX? ###

**SVARX** (**S**emantical **VA**lidation **R**ulesets **X**ML, pronounced [sva:rks]) is an XML-based format for semantical description of web form validation rules, independent of programming languages or platforms.

Currently, a production-quality client-side JavaScript implenentation is available as a jQuery plugin which can perform web form validation using external SVARX xml files (or a JSON bridge for those passionate Crockford followers :-).

SVARX itself doesn't specify any special way to respond to validation errors, or even any special way to visualize validation process. For all visualizations, second-level plugins are used which work through a very straightforward and simple API.

SVARX is used in production environment in some Yandex (www.yandex.ru) projects such as sprav.yandex.ru and passport.yandex.ru.

### Features ###
#### What SVARX could do for you ####
  * describe form validation in XML using built-in rules
  * add your own rules of arbitrary complexity
  * combine single rules into sets (blocks) using AND/OR logics
  * use inverted rules (NOT logics)
  * describe conditional validation rules, even quite complex ones, (if..then..else)
  * semantically describe preprocessing requirements for data being validated
  * specify named identifiers for validation errors

SVARX files are **under 1 KB** for simple, "everyday Web" forms, and about **3-5 KB** for more complicated cases.

#### jQuery implementation (plugin) ####
  * validate forms on submit and other eve nts of your choice using externals SVARX files or dynamically generated JSON
  * write your own validation rules in JavaScript while preserving semantical approach in XML
  * supports second-level plugins to visualize validation errors, and provides some basic examples out of the box
  * allows for manual control over the validation process using advanced event-based API

### SVARX rules: basic example ###

```xml
<svarx version="2">

<!-- a block of preprocessing rules applied before validation, optional -->
    <preprocess>
        <rule type="trim">
            <el name="newpasswd" />
            <el name="newpasswd2" />
        </rule>
    </preprocess>

<!-- validation rules -->
    <validate>
        <rule for="passwd" type="required" onerror="oldpasswd_req" />
        <rule type="eq" inverted="inverted" onerror="oldnew_equal">
            <el name="passwd" />
            <el name="newpasswd" />
        </rule>
    </validate>
</svarx>
```