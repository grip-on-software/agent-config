$(document).ready(function() {
    function updateIds(componentName) {
        var pattern = new RegExp("([\\w_]*)" + componentName + "_\\d+([\\w_\\[\\]]+)");

        $(".component[id^=" + componentName + "]").each(function(index) {
            var component = $(this),
                sequence = new String(index + 1);
            function replaceId(element, attribute) {
                if (typeof attribute === "string") {
                    element.attr(attribute, function(i, value) {
                        if (typeof value === "undefined") {
                            return;
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
            component.find('.name .sequence').text('(' + sequence + ')');

            replaceId(component.find('.field label'), 'for');
            replaceId(component.find('.field input, .field select, .field textarea, .field button'),
                      ['id', 'name']);
        });
    }
    $(".component .clone button.add").on("click", function() {
        var component = $(this).parent().parent(),
            componentId = component.attr('id'),
            componentName = componentId.substr(0, componentId.lastIndexOf('_'));

        var textNode = $(document.createTextNode(' '));
        component.clone(true).insertAfter(textNode.insertAfter(component));
        updateIds(componentName);
    });
    $(".component .clone button.remove").on("click", function() {
        var component = $(this).parent().parent(),
            componentId = component.attr('id'),
            componentName = componentId.substr(0, componentId.lastIndexOf('_'));

        component.remove();
        updateIds(componentName);
    });
});
