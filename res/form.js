$(document).ready(function() {
    function updateIds(componentName, componentClass) {
        var pattern = new RegExp("([\\w_]*)" +
            componentName.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1") +
            "_\\d+([\\w_\\[\\]]+)"
        );

        var components = $("." + componentClass + "[id^=\"" + componentName + "\"]");
        components.each(function(index) {
            var component = $(this),
                sequence = String(index + 1);
            function replaceId(element, attribute) {
                if (typeof attribute === "string") {
                    element.attr(attribute, function(i, value) {
                        if (typeof value === "undefined") {
                            return null;
                        }
                        var replacement = '$1' + componentName + '_' + sequence + '$2';
                        return value.replace(pattern, replacement);
                    });
                }
                else {
                    attribute.forEach(function(attr) {
                        replaceId(element, attr);
                    });
                }
            }
            component.attr('id', componentName + '_' + sequence);
            component.find('.sequence').text('(' + sequence + ')');
            component.find('.clone .remove').attr('disabled',
                components.length === 1
            );

            replaceId(component.find('.field label'), 'for');
            replaceId(component.find('.field input, .field select, .field textarea, .field button, .item'),
                      ['id', 'name']);
        });
    }
    $(".component .clone button.add").on("click", function() {
        var component = $(this).parent().parent(),
            componentClass = component.attr('class'),
            componentId = component.attr('id'),
            componentName = componentId.substr(0, componentId.lastIndexOf('_'));

        var textNode = $(document.createTextNode(' '));
        var newComponent = component.clone(true);
        var select = newComponent.find('select');
        component.find('select').each(function(index) {
            select.get(index).selectedIndex = this.selectedIndex;
        });
        newComponent.insertAfter(textNode.insertAfter(component));
        updateIds(componentName, componentClass);
    });
    $(".component .clone button.remove").on("click", function() {
        var component = $(this).parent().parent(),
            componentId = component.attr('id'),
            componentClass = component.attr('class'),
            componentName = componentId.substr(0, componentId.lastIndexOf('_'));

        component.remove();
        updateIds(componentName, componentClass);
    });
    $(".longer_hint a").attr("target", "_blank");

    $(".component").each(function() {
        var component = $(this);
        if (component.find(".expand").css("display", "none").length) {
            var toggle = $("<div></div>").attr("class", "toggle-expand")
                .append($("<i></i>").attr("class", "fas fa-angle-double-down"));
            toggle.on("click", function() {
                var expand = $(this).attr("class") === "toggle-expand";
                $(this).parents(".component").find(".expand")
                    .css("display", expand ? "block" : "none");
                $(this).attr("class", "toggle-" + (expand ? "collapse" : "expand"))
                    .find("i").attr("class", "fas fa-angle-double-" + (expand ? "up" : "down"));
            });
            component.append(toggle);
        }
    });

    window.form_is_ready = true;
});
