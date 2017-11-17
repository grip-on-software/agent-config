$(document).ready(function() {
    $('#version button.update').on('click', function() {
        var spinner = $('<i></i>').attr('class', 'fa fa-spinner fa-spin');
        $(this).replaceWith(spinner);
        $.ajax('/update', {
            dataType: 'json',
            context: spinner
        }).done(function(data) {
            $(this).replaceWith($('<span></span>')
                .attr('class', data.up_to_date ? 'status-ok' : 'status-fail')
                .text(data.message ? data.message :
                    (data.up_to_date ? 'Up to date' : 'Latest version: ' + data.version)
                )
            );
        })
    });
});
