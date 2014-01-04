(function() {
    'use strict';

    /**
     * This plugin provides a style editor which can manipulate {StyleRule}s associated with
     * {THREE.Material}s.
     *
     * This plugin only performs temporary modification of styles; subsequent page reloads or
     * navigations will destroy the modifications.
     */
    angular.module('styleEdit', []);

    /**
     * This controller contains the business logic for the style editor.
     *
     * It loads a list of rules from the {StyleContext}, and keeps track of which rule is
     * currently being worked on.  Any given rule's style may be edited, and it
     * keeps track of which style attribute is being worked on (via currentEditStyleAttr).
     */
    angular.module('styleEdit').controller('controller', [
        '$scope',
        function($scope)
    {
        // A working set of style rules
        $scope.rules = [];

        // The currently selected rule
        $scope.rule  = null;

        // The color that the color picker should display ('#ff00ff')
        $scope.pickerColor = null;

        // Show / hide the color picker
        $scope.showPicker = false;

        // Attribute of the style being edited ('color', 'linewidth', etc)
        $scope.currentEditStyleAttr = null;

        /**
         * @param {String}  attrName  Name of the attribute
         * @returns {boolean} true if the given attribute should have a color picker
         */
        $scope.attributeHasColorPicker = function(attrName) {
            return ['color', 'ambient', 'emissive', 'fillStyle', 'specular'].indexOf(attrName) !== -1;
        };

        /**
         * @param {String}  attrName  Name of the attribute
         * @returns {boolean} true if the given attribute has values which are hex colors
         */
        $scope.attributeIsHexColor = function(attrName) {
            return ['color', 'ambient', 'emissive', 'specular'].indexOf(attrName) !== -1;
        };

        /**
         * Convert a value to a suitable string for the color picker
         * @param {String}  attrName   Name of the attribute that the value is associated with
         * @param {String}  attrValue  Value to convert for the color picker
         * @returns {String} a color picker formatted string ('#ff00ff')
         */
        $scope.styleToPickerColor = function(attrName, attrValue) {
            if (attrName === 'fillStyle') {
                return jQuery.Color(attrValue).toHexString();
            }
            return attrValue;
        };

        /**
         * Converts a color string from the colorpicker into an attribute value
         * @param {String}  attrName  Name fo the attribute (i.e. 'fillStyle')
         * @param {String}  color     Color from the colorpicker ('#ff00ff')
         * @returns {String} a value suitable for the given attribute
         */
        $scope.pickerColorToStyle = function(attrName, color) {
            if (attrName === 'fillStyle') {
                return jQuery.Color(color).toRgbaString();
            }
            return color;
        };

        /**
         * Make an editable style out of a style which comes directly out of a {StyleRule}.
         * Specifically, this turns hex colors into their string representation.
         *
         * @param {Object}  ruleStyle   Key-value style to transform into an editable version
         * @returns {Object} a editable copy of the passed style
         */
        $scope.makeEditableStyle = function(ruleStyle) {
            var style = {},
                val,
                attr;

            for (attr in ruleStyle) {
                val = ruleStyle[attr];
                if ($scope.attributeIsHexColor(attr)) {
                    style[attr] = "#" + val.toString(16);
                } else {
                    style[attr] = val;
                }
            }
            return style;
        };

        /**
         * Convert a string value into an object.  This method performs simple inference to
         * figure out the return value ('does it look like a number?  does it look like a bool?)
         *
         * @param {String}  val  Value to convert
         * @returns {*} Returns a boolean if the value is 'true', or 'false', a number if it is
         *              numeric, else the passed value.
         */
        $scope.convertTextStyleAttributeToObject = function(val) {
            val = val.trim();

            if (!isNaN(val)) {
                val = +val;
            } else if (val === 'true') {
                val = true;
            } else if (val === 'false') {
                val = false;
            }
            return val;
        };

        /**
         * Load the {StyleRule}s from the {StyleContext} into the scope's .rules field.
         */
        $scope.refresh = function refresh() {
            var styleContext = $scope.styleContext;

            $scope.rules = [];
            styleContext.ruleList.eachRule(function(rule) {
                $scope.rules.push({
                    selector:    rule.selector,
                    specificity: rule.specificity,
                    style:       $scope.makeEditableStyle(rule.style),
                    backingRule: rule
                });
            });
            $scope.rules.reverse();
        };

        /**
         * Update currently edited style and the backend {StyleRule} for the given style
         * attribute.
         *
         * @param {String}  styleAttr  Attribute to update ('color', 'linewidth', etc.)
         * @param {String}  val        Value to assign to the style attribute.  This value
         *                             is potentially translated into a rich object before
         *                             being applied to the style.
         */
        $scope.updateStyle = function(styleAttr, val) {
            val = $scope.convertTextStyleAttributeToObject(val);
            var styleUpdate = {};
            styleUpdate[styleAttr] = val;
            $scope.rule.backingRule.updateStyle(styleUpdate);
            $scope.rule.style[styleAttr] = val;
        };

        /**
         * Callback invoked when the color picker's value changes.
         *
         * @param {String} color   The color picker's changed value ('#ff00ff')
         */
        $scope.onPickerChange = function(color) {
            var styleAttr = $scope.currentEditStyleAttr;
            $scope.updateStyle(styleAttr, $scope.pickerColorToStyle(styleAttr, color));
        };

        /**
         * Callback invoked when the currently edited style attribute is blurred (loses focus).
         */
        $scope.onEditBlur = function() {
            $scope.showPicker = false;
        };

        /**
         * Callback invoked when a style attribute is focused.  For certain attributes, this
         * method will trigger the display of the color picker.
         *
         * @param {String}  styleAttr  Attribute which is being focused.
         */
        $scope.onEditFocus = function(styleAttr) {
            $scope.currentEditStyleAttr = styleAttr;
            if ($scope.attributeHasColorPicker(styleAttr)) {
                $scope.pickerColor = $scope.styleToPickerColor(styleAttr,
                                                               $scope.rule.style[styleAttr]);
                $scope.showPicker  = true;
            } else {
                $scope.showPicker  = false;
            }
        };

        /**
         * Callback which is invoked when a change occurs on the currently edited style.
         *
         * @param {String} value    The edited value
         */
        $scope.onEditChange = function(value) {
            if ($scope.attributeHasColorPicker($scope.currentEditStyleAttr)) {
                $scope.pickerColor = value;
            }
        };

        $scope.refresh();
    }]);

    angular.module('styleEdit').directive('styleEditWidget', function() {
        return {
            restrict:    'E',
            templateUrl: 'lib/style-editor/styleEdit.html',
            replace:     true,
            controller: 'controller',
            scope: {
                styleContext: '='
            }
        };
    });

    /**
     * The 'editable' directive binds edit related events to an element, calling methods in the
     * associated scope when events occur.
     *
     * This directive is specific to the style edit plugin, in that it knows something about
     * style (it uses the styleattr attribute).
     */
    angular.module('styleEdit').directive('editable', function() {
        return {
            require: 'ngModel',
            link: function(scope, elm, attrs, ctrl) {
                // view -> model
                elm.bind('blur', function() {
                    scope.$apply(function() {
                        ctrl.$setViewValue(elm.html());
                        scope.onEditBlur();
                    });
                });

                elm.bind('focus', function() {
                    scope.$apply(function() {
                        scope.onEditFocus(attrs.styleattr);
                    });
                });

                elm.bind('keyup change', function() {
                    scope.$apply(function() {
                        scope.onEditChange(elm.text().trim());
                    });
                });

                // model -> view
                ctrl.$render = function(value) {
                    elm.html(value);
                };
            }
        };
    });

    /**
     * The colorpicker directive places a Raphael colorpicker widget at the point of the
     * element which declares it.
     *
     * Usage:
     *         <div colorpicker='true'
     *              color='{{ myColor }}'
     *              visible='{{ pickerVisible }}'
     *              on-color-change='updateColor(color)'></div>
     */
    angular.module('styleEdit').directive('colorpicker', function() {
        return {
            scope: {
                color:   '@',
                visible: '@',
                onColorChange: '&'
            },
            link: function(scope, elm, attrs) {
                var colorpicker;

                attrs.$observe('color', function(newValue) {
                    if (colorpicker && newValue) {
                        colorpicker.color(newValue);
                    }
                });

                attrs.$observe('visible', function(visible) {
                    visible = scope.$eval(visible);
                    if (!visible) {
                        if (colorpicker) {
                            colorpicker.remove();
                            colorpicker = null;
                        }
                    } else {
                        if (colorpicker) {
                            return;
                        }

                        var height = elm.height(),
                            x      = elm.offset().left,
                            y      = elm.offset().top;
                        colorpicker = Raphael.colorpicker(x, y, height, scope.color, elm.get(0));

                        colorpicker.onchange = function(color) {
                            scope.$apply(function() {
                                scope.onColorChange({color: color});
                            });
                        };
                    }
                });
            }
        };
    });
}());
