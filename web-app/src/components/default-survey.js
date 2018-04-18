const personal = {
    questions: [
        {
          name: "name",
          type: "text",
          title: "Please enter your name:",
          html: "<p>helloworld</p>",
          placeHolder: "Jon Snow",
          isRequired: true
        }, {
            name: "birthdate",
            type: "text",
            inputType: "date",
            title: "Your birthdate:",
            isRequired: true
        }, {
            name: "color",
            type: "text",
            inputType: "color",
            title: "Your favorite color:"
        }, {
            name: "email",
            type: "text",
            inputType: "email",
            title: "Your e-mail:",
            placeHolder: "jon.snow@nightwatch.org",
            isRequired: true,
            validators: [
                {
                    type: "email"
                }
            ]
        }
    ]
};

module.exports = {
  personal
}
