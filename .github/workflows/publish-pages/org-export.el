; Initialize package system
(require 'package)

;; Add package archives
(add-to-list 'package-archives '("melpa" . "https://melpa.org/packages/") t)
(add-to-list 'package-archives '("gnu" . "https://elpa.gnu.org/packages/") t)

;; Initialize packages
(package-initialize)

;; Refresh package contents if needed
(unless package-archive-contents
  (package-refresh-contents))

;; Install or update htmlize
(unless (package-installed-p 'htmlize)
  (package-install 'htmlize))

;; For updating existing packages
(when (package-installed-p 'htmlize)
  (package-reinstall 'htmlize))

;; Configure org-mode export
(require 'org)
(require 'ox-html)
(require 'htmlize)
          
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