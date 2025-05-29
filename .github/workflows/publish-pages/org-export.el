(package-initialize)

;; Configure org-mode export
(require 'org)
(require 'ox-html)
          
;; Set up HTML export options
(setq 
    org-export-with-broken-links 'mark
    org-html-htmlize-output-type 'css
    org-html-validation-link nil
    org-html-head-include-scripts nil
    org-html-head-include-default-style nil
    org-html-head "<link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\" />")
          
;; Export function
(defun export-org-file (file)
    "Export org FILE to HTML."
    (with-current-buffer (find-file-noselect file)
        (org-html-export-to-html)))
          
    ;; Process command line argument
    (let ((file (car command-line-args-left)))
        (when file
            (export-org-file file)))