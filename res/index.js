$(document).ready(function() {
    $('#version button.update').on('click', function() {
        const spinner = $('<i></i>').attr('class', 'fas fa-spinner fa-spin');
        $(this).replaceWith(spinner);
        $.ajax('/update', {
            dataType: 'json',
            context: spinner
        }).done(function(data) {
            let message = data.message;
            if (!message) {
                message = (data.up_to_date ? 'Up to date' :
                    'Latest version: ' + data.version
                );
            }
            $(this).replaceWith($('<span></span>')
                .attr('class', data.up_to_date ? 'status-ok' : 'status-fail')
                .text(message)
            );
        }).fail(function(jqXHR, textStatus, errorThrown) {
            let statusMessage = String(errorThrown);
            if (jqXHR.responseText !== '' &&
                jqXHR.getResponseHeader('Content-Type') === 'application/json'
            ) {
                statusMessage = JSON.parse(jqXHR.responseText).message;
            }
            $(this).replaceWith($('<span></span>')
                .attr('class', 'status-fail')
                .text('Could not reach the controller: ' + statusMessage)
            );
        });
    });
});
