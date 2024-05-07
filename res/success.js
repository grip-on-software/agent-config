$(document).ready(function() {
    $('#options button.scrape').on('click', function() {
        const spinner = $('<i></i>').attr('class', 'fas fa-spinner fa-spin');
        $(this).replaceWith(spinner);
        $.ajax('/scrape', {
            dataType: 'json',
            context: spinner,
            method: 'POST'
        }).done(function(data) {
            $(this).replaceWith($('<span></span>')
                .attr('class', data.ok ? 'status-ok' : 'status-fail')
                .text(data.error ? data.error.message : 'Scrape job started.')
            );
        }).fail(function(jqXHR, textStatus, errorThrown) {
            let statusMessage = String(errorThrown);
            if (jqXHR.responseText !== '' &&
                jqXHR.getResponseHeader('Content-Type') === 'application/json'
            ) {
                const response = JSON.parse(jqXHR.responseText);
                if (response.error) {
                    statusMessage += ': ' + response.error.message;
                }
            }
            $(this).replaceWith($('<span></span>')
                .attr('class', 'status-fail')
                .text('Could not reach the agent: ' + statusMessage)
            );
        });
    });
});
