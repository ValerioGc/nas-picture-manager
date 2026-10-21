Feature: Annotating images
  Scenario: Draw a filled square at a custom zoom and export a PNG copy
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw a filled square at double zoom
    Then annotations have unsaved changes
    When I save and reopen a PNG copy
    Then the square is included in the image
    And the source fixture is unchanged

  Scenario: Move, resize, undo and delete a circle
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw and move a circle
    And I resize the selected annotation
    And I undo and redo the annotation
    And I delete the selected annotation
    Then no annotations remain

  Scenario: Annotated lines follow image rotation
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw an annotation line
    And I rotate the image clockwise
    And I save and reopen a WebP copy
    Then the annotation line is included after rotation

  Scenario: Highlighting preserves the underlying pixels
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw a highlighter stroke
    And I save and reopen a PNG copy
    Then the exported highlighter is translucent

  Scenario: Multiline text remains editable before export
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I place and edit multiline text
    And I save and reopen a PNG copy
    Then the exported image contains annotation text

  Scenario: Pen marks are exported in JPEG and reset removes annotations
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw a pen stroke
    And I reset all edits
    Then no annotations remain
    When I draw a pen stroke
    And I save and reopen a JPEG copy
    Then the exported image contains a pen stroke

  Scenario: Annotations export at full resolution beyond the preview limit
    Given I open the application
    When I open a large annotation fixture
    And I open the edit panel
    And I open the annotations tool
    And I annotate and export the large image
    Then the full-size exported annotation has the expected pixels

  Scenario: Annotation controls open on demand and deactivate when changing tools
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    Then annotation controls are hidden
    When I open the annotations tool
    Then annotation tools have icons and tooltips
    When I draw an annotation line
    And I rotate the image clockwise
    Then annotation controls are hidden
    When I open the annotations tool
    Then annotations have unsaved changes

  Scenario: Unsaved pen marks survive a cancelled browser reload
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw a pen stroke
    And I cancel reloading with unsaved changes
    Then the reload keeps unsaved edits
    When I save and reopen a PNG copy
    Then the exported image contains a pen stroke

  Scenario: Unsaved drawings ask for confirmation before opening details
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I open the annotations tool
    And I draw a pen stroke
    And I request leaving edits using "info_toggle"
    Then the edit exit confirmation is visible
    When I cancel leaving the edit panel
    Then annotations have unsaved changes
    When I request leaving edits using "info_toggle"
    And I confirm leaving the edit panel
    Then the active side panel is "info"
    When I open the edit panel
    And I open the annotations tool
    Then no annotations remain
    And the original pixels are restored
