/* eslint-disable mocha/no-setup-in-describe */
"use strict";

const chai = require("chai");
const parser = require("../../lib/parser");
const { RESERVED_WORDS } = require("../../lib/peg.js");

const expect = chai.expect;

describe("Peggy grammar parser", () => {
  const literalAbcd       = { type: "literal",      value: "abcd", ignoreCase: false };
  const literalEfgh       = { type: "literal",      value: "efgh", ignoreCase: false };
  const literalIjkl       = { type: "literal",      value: "ijkl", ignoreCase: false };
  const literalMnop       = { type: "literal",      value: "mnop", ignoreCase: false };
  const semanticAnd       = { type: "semantic_and", code: " code " };
  const semanticNot       = { type: "semantic_not", code: " code " };
  const optional          = { type: "optional",     expression: literalAbcd };
  const zeroOrMore        = { type: "zero_or_more", expression: literalAbcd };
  const oneOrMore         = { type: "one_or_more",  expression: literalAbcd };
  const textOptional      = { type: "text",         expression: optional };
  const simpleNotAbcd     = { type: "simple_not",   expression: literalAbcd };
  const simpleAndOptional = { type: "simple_and",   expression: optional };
  const simpleNotOptional = { type: "simple_not",   expression: optional };
  const labeledAbcd       = { type: "labeled",      label: "a", expression: literalAbcd };
  const labeledEfgh       = { type: "labeled",      label: "b", expression: literalEfgh };
  const labeledIjkl       = { type: "labeled",      label: "c", expression: literalIjkl };
  const labeledMnop       = { type: "labeled",      label: "d", expression: literalMnop };
  const labeledSimpleNot  = { type: "labeled",      label: "a", expression: simpleNotAbcd };
  const sequence          = {
    type: "sequence",
    elements: [literalAbcd, literalEfgh, literalIjkl],
  };
  const sequence2         = {
    type: "sequence",
    elements: [labeledAbcd, labeledEfgh],
  };
  const sequence4         = {
    type: "sequence",
    elements: [labeledAbcd, labeledEfgh, labeledIjkl, labeledMnop],
  };
  const groupLabeled      = { type: "group",  expression: labeledAbcd };
  const groupSequence     = { type: "group",  expression: sequence };
  const actionAbcd        = { type: "action", expression: literalAbcd, code: " code " };
  const actionEfgh        = { type: "action", expression: literalEfgh, code: " code " };
  const actionIjkl        = { type: "action", expression: literalIjkl, code: " code " };
  const actionMnop        = { type: "action", expression: literalMnop, code: " code " };
  const actionSequence    = { type: "action", expression: sequence,    code: " code " };
  const choice            = {
    type: "choice",
    alternatives: [literalAbcd, literalEfgh, literalIjkl],
  };
  const choice2           = {
    type: "choice",
    alternatives: [actionAbcd, actionEfgh],
  };
  const choice4           = {
    type: "choice",
    alternatives: [actionAbcd, actionEfgh, actionIjkl, actionMnop],
  };
  const named               = { type: "named",       name: "start rule", expression: literalAbcd };
  const ruleA               = { type: "rule",        name: "a",          expression: literalAbcd };
  const ruleB               = { type: "rule",        name: "b",          expression: literalEfgh };
  const ruleC               = { type: "rule",        name: "c",          expression: literalIjkl };
  const ruleStart           = { type: "rule",        name: "start",      expression: literalAbcd };
  const topLevelInitializer = { type: "top_level_initializer", code: " top level code " };
  const initializer         = { type: "initializer",           code: " code " };

  function oneRuleGrammar(expression) {
    return {
      type: "grammar",
      imports: [],
      topLevelInitializer: null,
      initializer: null,
      rules: [{ type: "rule", name: "start", expression }],
    };
  }

  function actionGrammar(code) {
    return oneRuleGrammar(
      { type: "action", expression: literalAbcd, code }
    );
  }

  function literalGrammar(value, ignoreCase) {
    return oneRuleGrammar(
      { type: "literal", value, ignoreCase }
    );
  }

  function classGrammar(parts, inverted, ignoreCase, unicode = false) {
    return oneRuleGrammar({
      type: "class",
      parts,
      inverted,
      ignoreCase,
      unicode,
    });
  }

  function anyGrammar(unicode) {
    const r = { type: "any" };
    if (unicode) {
      r.unicode = true;
    }
    return oneRuleGrammar(r);
  }

  function ruleRefGrammar(name) {
    return oneRuleGrammar({ type: "rule_ref", name });
  }

  function repeatedGrammar(min, max, type = "variable", delimiter = null) {
    return oneRuleGrammar({
      type: "repeated",
      min: { type: typeof min === "string" ? type : "constant", value: min },
      max: { type: typeof max === "string" ? type : "constant", value: max },
      expression: literalAbcd,
      delimiter,
    });
  }
  function repeatedGrammar2(min, max) {
    return repeatedGrammar(min, max, "function");
  }
  function repeatedGrammar3(min, max) {
    return repeatedGrammar(min, max, "variable", literalEfgh);
  }
  function repeatedGrammar4(min, max) {
    return repeatedGrammar(min, max, "function", literalEfgh);
  }

  const trivialGrammar = literalGrammar("abcd", false);
  const twoRuleGrammar = {
    type: "grammar",
    imports: [],
    topLevelInitializer: null,
    initializer: null,
    rules: [ruleA, ruleB],
  };

  const stripLocation = (function() {
    function buildVisitor(functions) {
      return function(node, ...args) {
        return functions[node.type](node, ...args);
      };
    }

    function stripLeaf(node) {
      delete node.location;
      delete node.codeLocation;
      delete node.nameLocation;
      delete node.labelLocation;
    }

    function stripExpression(node) {
      delete node.location;
      delete node.codeLocation;
      delete node.nameLocation;
      delete node.labelLocation;

      // eslint-disable-next-line no-use-before-define -- Mutual recursion
      strip(node.expression);
    }

    function stripChildren(property) {
      return function(node) {
        delete node.location;
        delete node.codeLocation;
        delete node.nameLocation;
        delete node.labelLocation;

        // eslint-disable-next-line no-use-before-define -- Mutual recursion
        node[property].forEach(strip);
      };
    }

    const strip = buildVisitor({
      grammar(node) {
        delete node.location;
        delete node.codeLocation;
        delete node.nameLocation;
        delete node.labelLocation;

        if (node.topLevelInitializer) {
          strip(node.topLevelInitializer);
        }
        if (node.initializer) {
          strip(node.initializer);
        }
        node.rules.forEach(strip);
      },

      top_level_initializer: stripLeaf,
      initializer: stripLeaf,
      rule: stripExpression,
      named: stripExpression,
      choice: stripChildren("alternatives"),
      action: stripExpression,
      sequence: stripChildren("elements"),
      labeled: stripExpression,
      text: stripExpression,
      simple_and: stripExpression,
      simple_not: stripExpression,
      optional: stripExpression,
      zero_or_more: stripExpression,
      one_or_more: stripExpression,
      repeated(node) {
        if (node.min) {
          delete node.min.location;
          delete node.min.codeLocation;
        }
        delete node.max.location;
        delete node.max.codeLocation;
        delete node.location;
        strip(node.expression);

        if (node.delimiter) {
          delete node.delimiter.location;

          strip(node.delimiter);
        }
      },
      group: stripExpression,
      semantic_and: stripLeaf,
      semantic_not: stripLeaf,
      rule_ref: stripLeaf,
      library_ref: stripLeaf,
      literal: stripLeaf,
      class(node) {
        stripLeaf(node);
        for (const p of node.parts) {
          if (typeof p === "object") {
            stripLeaf(p);
          }
        }
      },
      any: stripLeaf,
    });

    return strip;
  })();

  function helpers(chai, utils) {
    const Assertion = chai.Assertion;

    Assertion.addMethod("parseAs", function(expected) {
      const result = parser.parse(utils.flag(this, "object"));

      stripLocation(result);

      this.assert(
        utils.eql(result, expected),
        "expected #{this} to parse as #{exp} but got #{act}",
        "expected #{this} to not parse as #{exp}",
        expected,
        result,
        !utils.flag(this, "negate")
      );
    });

    Assertion.addMethod("failToParse", function(props) {
      let passed = false;
      let result = undefined;

      try {
        result = parser.parse(utils.flag(this, "object"));
        passed = true;
      } catch (e) {
        result = e;
      }

      if (passed) {
        stripLocation(result);
      }

      this.assert(
        !passed,
        "expected #{this} to fail to parse but got #{act}",
        "expected #{this} to not fail to parse but it failed with #{act}",
        null,
        result
      );

      if (!passed && props !== undefined) {
        Object.keys(props).forEach(key => {
          new Assertion(result).to.have.property(key)
            .that.is.deep.equal(props[key]);
        });
      }
    });
  }

  // Helper activation needs to put inside a |beforeEach| block because the
  // helpers conflict with the ones in
  // test/behavior/generated-parser-behavior.spec.js.
  beforeEach(() => {
    chai.use(helpers);
  });

  // Canonical Grammar is "a = 'abcd'; b = 'efgh'; c = 'ijkl';".
  it("parses Grammar", () => {
    expect("\na = 'abcd';\n").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer: null, initializer: null, rules: [ruleA] }
    );
    expect("\na = 'abcd'; /* comment */; // comment\n;\nb = 'efgh';\nc = 'ijkl';\n").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer: null, initializer: null, rules: [ruleA, ruleB, ruleC] }
    );
    expect("\n{ code };\na = 'abcd';\n").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer: null, initializer, rules: [ruleA] }
    );
    expect("\n{{ top level code }};\na = 'abcd';\n").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer, initializer: null, rules: [ruleA] }
    );
    expect("\n{{ top level code }};\n{ code };\na = 'abcd';\n").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer, initializer, rules: [ruleA] }
    );
    expect("").to.failToParse();
    expect("{{ ").to.failToParse();
    expect("{ ").to.failToParse();
    expect("{{}").to.failToParse();
    expect("{{}}\x00").to.failToParse();
  });

  // Canonical Top-Level Initializer is "{ top level code }".
  it("parses Top-Level Initializer", () => {
    expect("{{ top level code }};start = 'abcd'").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer, initializer: null, rules: [ruleStart] }
    );
  });

  // Canonical Initializer is "{ code }".
  it("parses Initializer", () => {
    expect("{ code };start = 'abcd'").to.parseAs(
      { type: "grammar", imports: [], topLevelInitializer: null, initializer, rules: [ruleStart] }
    );
  });

  // Canonical Rule is "a = 'abcd';".
  it("parses Rule", () => {
    expect("start\n=\n'abcd';").to.parseAs(
      oneRuleGrammar(literalAbcd)
    );
    expect("start\n'start rule'\n=\n'abcd';").to.parseAs(
      oneRuleGrammar(named)
    );
  });

  // Canonical Expression is "'abcd'".
  it("parses Expression", () => {
    expect("start = 'abcd' / 'efgh' / 'ijkl'").to.parseAs(
      oneRuleGrammar(choice)
    );
  });

  // Canonical ChoiceExpression is "'abcd' / 'efgh' / 'ijkl'".
  it("parses ChoiceExpression", () => {
    expect("start = 'abcd' { code }").to.parseAs(
      oneRuleGrammar(actionAbcd)
    );
    expect("start = 'abcd' { code }\n/\n'efgh' { code }").to.parseAs(
      oneRuleGrammar(choice2)
    );
    expect(
      "start = 'abcd' { code }\n/\n'efgh' { code }\n/\n'ijkl' { code }\n/\n'mnop' { code }"
    ).to.parseAs(
      oneRuleGrammar(choice4)
    );
    expect(
      "start = 'a' / 'b' /"
    ).to.failToParse();
  });

  // Canonical ActionExpression is "'abcd' { code }".
  it("parses ActionExpression", () => {
    expect("start = 'abcd' 'efgh' 'ijkl'").to.parseAs(
      oneRuleGrammar(sequence)
    );
    expect("start = 'abcd' 'efgh' 'ijkl'\n{ code }").to.parseAs(
      oneRuleGrammar(actionSequence)
    );
  });

  // Canonical SequenceExpression is "'abcd' 'efgh' 'ijkl'".
  it("parses SequenceExpression", () => {
    expect("start = a:'abcd'").to.parseAs(
      oneRuleGrammar(labeledAbcd)
    );
    expect("start = a:'abcd'\nb:'efgh'").to.parseAs(
      oneRuleGrammar(sequence2)
    );
    expect("start = a: 'abcd'\nb :'efgh'").to.parseAs(
      oneRuleGrammar(sequence2)
    );
    expect("start = a:'abcd'\nb:'efgh'\nc:'ijkl'\nd:'mnop'").to.parseAs(
      oneRuleGrammar(sequence4)
    );
    expect("start = a:'foo").to.failToParse();
  });

  // Value Plucking
  it("parses `@` (value plucking)", () => {
    function $S(...elements) {
      return oneRuleGrammar({
        type: "sequence",
        elements,
      });
    }
    function $P(label, expression) {
      return {
        type: "labeled",
        pick: true,
        label,
        expression,
      };
    }

    expect("start = @'abcd'").to.parseAs(
      $S($P(null, literalAbcd))
    );
    expect("start = @a:'abcd'").to.parseAs(
      $S($P("a", literalAbcd))
    );
    expect("start = @a: 'abcd'").to.parseAs(
      $S($P("a", literalAbcd))
    );
    expect("start = @a :'abcd'").to.parseAs(
      $S($P("a", literalAbcd))
    );
    expect("start = @a : 'abcd'").to.parseAs(
      $S($P("a", literalAbcd))
    );
    expect("start = 'abcd' @'efgh'").to.parseAs(
      $S(literalAbcd, $P(null, literalEfgh))
    );
    expect("start = a:'abcd' @b:'efgh'").to.parseAs(
      $S(labeledAbcd, $P("b", literalEfgh))
    );
    expect("start = @'abcd' b:'efgh'").to.parseAs(
      $S($P(null, literalAbcd), labeledEfgh)
    );
    expect("start = a:'abcd' @'efgh' 'ijkl' @d:'mnop'").to.parseAs(
      $S(labeledAbcd, $P(null, literalEfgh), literalIjkl, $P("d", literalMnop))
    );
  });

  // Canonical LabeledExpression is "a:'abcd'".
  it("parses LabeledExpression", () => {
    expect("start = a\n:\n!'abcd'").to.parseAs(oneRuleGrammar(labeledSimpleNot));
    expect("start = !'abcd'").to.parseAs(oneRuleGrammar(simpleNotAbcd));
  });

  // Canonical PrefixedExpression is "!'abcd'".
  it("parses PrefixedExpression", () => {
    expect("start = !\n'abcd'?").to.parseAs(oneRuleGrammar(simpleNotOptional));
    expect("start = 'abcd'?").to.parseAs(oneRuleGrammar(optional));
  });

  // Canonical PrefixedOperator is "!".
  it("parses PrefixedOperator", () => {
    expect("start = $'abcd'?").to.parseAs(oneRuleGrammar(textOptional));
    expect("start = &'abcd'?").to.parseAs(oneRuleGrammar(simpleAndOptional));
    expect("start = !'abcd'?").to.parseAs(oneRuleGrammar(simpleNotOptional));
  });

  // Canonical SuffixedExpression is "'abcd'?".
  it("parses SuffixedExpression", () => {
    expect("start = 'abcd'\n?").to.parseAs(oneRuleGrammar(optional));
    expect("start = 'abcd'").to.parseAs(oneRuleGrammar(literalAbcd));
  });

  // Canonical SuffixedOperator is "?".
  it("parses SuffixedOperator", () => {
    expect("start = 'abcd'?").to.parseAs(oneRuleGrammar(optional));
    expect("start = 'abcd'*").to.parseAs(oneRuleGrammar(zeroOrMore));
    expect("start = 'abcd'+").to.parseAs(oneRuleGrammar(oneOrMore));
  });

  // Canonical PrimaryExpression is "'abcd'".
  it("parses PrimaryExpression", () => {
    expect("start = 'abcd'").to.parseAs(trivialGrammar);
    expect("start = [a-d]").to.parseAs(classGrammar([["a", "d"]], false, false));
    expect("start = .").to.parseAs(anyGrammar());
    expect("start = a").to.parseAs(ruleRefGrammar("a"));
    expect("start = &{ code }").to.parseAs(oneRuleGrammar(semanticAnd));

    expect("start = (\na:'abcd'\n)").to.parseAs(oneRuleGrammar(groupLabeled));
    expect("start = (\n'abcd' 'efgh' 'ijkl'\n)").to.parseAs(oneRuleGrammar(groupSequence));
    expect("start = (\n'abcd'\n)").to.parseAs(trivialGrammar);
    expect("start = ('foo'").to.failToParse();
    expect("start = ('foo").to.failToParse();
  });

  // Canonical RepeatedExpression is "'abcd'|2..3|".
  describe("parses RepeatedExpression", () => {
    describe("without delimiter", () => {
      it("with constant boundaries", () => {
        let grammar = repeatedGrammar(2, 3);
        expect("start = 'abcd'|2..3|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|2..3|").to.parseAs(grammar);
        expect("start = 'abcd'|\n2..3|").to.parseAs(grammar);
        expect("start = 'abcd'|2\n..3|").to.parseAs(grammar);
        expect("start = 'abcd'|2..\n3|").to.parseAs(grammar);
        expect("start = 'abcd'|2..3\n|").to.parseAs(grammar);

        grammar = oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "constant", value: 3 },
          expression: literalAbcd,
          delimiter: null,
        });
        expect("start = 'abcd'\n|3|").to.parseAs(grammar);
        expect("start = 'abcd'|\n3|").to.parseAs(grammar);
        expect("start = 'abcd'|3\n|").to.parseAs(grammar);
      });

      it("with variable boundaries", () => {
        let grammar = repeatedGrammar("min", "max");
        expect("start = 'abcd'|min..max|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|min..max|").to.parseAs(grammar);
        expect("start = 'abcd'|\nmin..max|").to.parseAs(grammar);
        expect("start = 'abcd'|min\n..max|").to.parseAs(grammar);
        expect("start = 'abcd'|min..\nmax|").to.parseAs(grammar);
        expect("start = 'abcd'|min..max\n|").to.parseAs(grammar);

        grammar = oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "variable", value: "exact" },
          expression: literalAbcd,
          delimiter: null,
        });
        expect("start = 'abcd'\n|exact|").to.parseAs(grammar);
        expect("start = 'abcd'|\nexact|").to.parseAs(grammar);
        expect("start = 'abcd'|exact\n|").to.parseAs(grammar);
      });

      it("with function boundaries", () => {
        let grammar = repeatedGrammar2("min", "max");
        expect("start = 'abcd'|{min}..{max}|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|{min}..{max}|").to.parseAs(grammar);
        expect("start = 'abcd'|\n{min}..{max}|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}\n..{max}|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..\n{max}|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..{max}\n|").to.parseAs(grammar);

        grammar = oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "function", value: "exact" },
          expression: literalAbcd,
          delimiter: null,
        });
        expect("start = 'abcd'\n|{exact}|").to.parseAs(grammar);
        expect("start = 'abcd'|\n{exact}|").to.parseAs(grammar);
        expect("start = 'abcd'|{exact}\n|").to.parseAs(grammar);
      });

      it("with mixed boundaries", () => {
        let grammar = repeatedGrammar(2, "max");
        expect("start = 'abcd'|2..max|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|2..max|").to.parseAs(grammar);
        expect("start = 'abcd'|\n2..max|").to.parseAs(grammar);
        expect("start = 'abcd'|2\n..max|").to.parseAs(grammar);
        expect("start = 'abcd'|2..\nmax|").to.parseAs(grammar);
        expect("start = 'abcd'|2..max\n|").to.parseAs(grammar);

        grammar = repeatedGrammar("min", 3);
        expect("start = 'abcd'|min..3|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|min..3|").to.parseAs(grammar);
        expect("start = 'abcd'|\nmin..3|").to.parseAs(grammar);
        expect("start = 'abcd'|min\n..3|").to.parseAs(grammar);
        expect("start = 'abcd'|min..\n3|").to.parseAs(grammar);
        expect("start = 'abcd'|min..3\n|").to.parseAs(grammar);
      });
    });

    describe("with delimiter", () => {
      it("with constant boundaries", () => {
        let grammar = repeatedGrammar3(2, 3);
        expect("start = 'abcd'|2..3,'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|2..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n2..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2\n..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..\n3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..3\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..3,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..3,'efgh'\n|").to.parseAs(grammar);
        expect("start = 'abcd'|2..3,'efgh").to.failToParse();

        grammar = oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "constant", value: 3 },
          expression: literalAbcd,
          delimiter: literalEfgh,
        });
        expect("start = 'abcd'\n|3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|3\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|3,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|3,'efgh'\n|").to.parseAs(grammar);

        expect("start = 'abcd'|3, 'efgh'?|").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "constant", value: 3 },
          expression: literalAbcd,
          delimiter: { type: "optional", expression: literalEfgh },
        }));
      });

      it("with variable boundaries", () => {
        let grammar = repeatedGrammar3("min", "max");
        expect("start = 'abcd'|min..max,'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|min..max,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\nmin..max,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min\n..max,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..\nmax,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..max\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..max,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..max,'efgh'\n|").to.parseAs(grammar);

        grammar = oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "variable", value: "exact" },
          expression: literalAbcd,
          delimiter: literalEfgh,
        });
        expect("start = 'abcd'\n|exact,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\nexact,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|exact\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|exact,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|exact,'efgh'\n|").to.parseAs(grammar);

        expect("start = 'abcd'|exact, 'efgh'?|").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "variable", value: "exact" },
          expression: literalAbcd,
          delimiter: { type: "optional", expression: literalEfgh },
        }));
      });

      it("with function boundaries", () => {
        let grammar = repeatedGrammar4("min", "max");
        expect("start = 'abcd'|{min}..{max},'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|{min}..{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n{min}..{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}\n..{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..\n{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..{max}\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..{max},\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..{max},'efgh'\n|").to.parseAs(grammar);

        grammar = oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "function", value: "exact" },
          expression: literalAbcd,
          delimiter: literalEfgh,
        });
        expect("start = 'abcd'\n|{exact},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n{exact},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{exact}\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{exact},\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{exact},'efgh'\n|").to.parseAs(grammar);

        expect("start = 'abcd'|{exact}, 'efgh'?|").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "function", value: "exact" },
          expression: literalAbcd,
          delimiter: { type: "optional", expression: literalEfgh },
        }));
      });

      it("with mixed boundaries", () => {
        let grammar = repeatedGrammar3(2, "max");
        expect("start = 'abcd'|2..max,'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|2..max,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n2..max,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2\n..max,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..\nmax,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..max\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..max,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..max,'efgh'\n|").to.parseAs(grammar);

        grammar = repeatedGrammar3("min", 3);
        expect("start = 'abcd'|min..3,'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|min..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\nmin..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min\n..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..\n3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..3\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..3,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|min..3,'efgh'\n|").to.parseAs(grammar);

        grammar = repeatedGrammar4(2, "max");
        expect("start = 'abcd'|2..{max},'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|2..{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n2..{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2\n..{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..\n{max},'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..{max}\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..{max},\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|2..{max},'efgh'\n|").to.parseAs(grammar);

        grammar = repeatedGrammar4("min", 3);
        expect("start = 'abcd'|{min}..3,'efgh'|  ").to.parseAs(grammar);
        expect("start = 'abcd'\n|{min}..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|\n{min}..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}\n..3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..\n3,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..3\n,'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..3,\n'efgh'|").to.parseAs(grammar);
        expect("start = 'abcd'|{min}..3,'efgh'\n|").to.parseAs(grammar);
      });
    });
  });

  // Canonical RepeatedOperator is "2..3".
  describe("parses RepeatedOperator", () => {
    describe("without delimiter", () => {
      it("with constant boundaries", () => {
        expect("start = 'abcd'| .. |").to.parseAs(repeatedGrammar(0, null));
        expect("start = 'abcd'|0.. |").to.parseAs(repeatedGrammar(0, null));
        expect("start = 'abcd'|1.. |").to.parseAs(repeatedGrammar(1, null));
        expect("start = 'abcd'|2.. |").to.parseAs(repeatedGrammar(2, null));

        expect("start = 'abcd'| ..1|").to.parseAs(repeatedGrammar(0, 1));
        expect("start = 'abcd'| ..2|").to.parseAs(repeatedGrammar(0, 2));

        expect("start = 'abcd'|2..2|").to.parseAs(repeatedGrammar(2, 2));
        expect("start = 'abcd'|2..3|").to.parseAs(repeatedGrammar(2, 3));
        expect("start = 'abcd'|3|   ").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "constant", value: 3 },
          expression: literalAbcd,
          delimiter: null,
        }));

        expect("start = 'abcd'| ..0|").to.failToParse();
        expect("start = 'abcd'|0..0|").to.failToParse();
        expect("start = 'abcd'|0|   ").to.failToParse();
      });

      it("with variable boundaries", () => {
        expect("start = 'abcd'|min..   |").to.parseAs(repeatedGrammar("min", null));
        expect("start = 'abcd'|   ..max|").to.parseAs(repeatedGrammar(0, "max"));
        expect("start = 'abcd'|min..max|").to.parseAs(repeatedGrammar("min", "max"));
        expect("start = 'abcd'|exact|   ").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "variable", value: "exact" },
          expression: literalAbcd,
          delimiter: null,
        }));
      });

      it("with function boundaries", () => {
        expect("start = 'abcd'|{min}..     |").to.parseAs(repeatedGrammar2("min", null));
        expect("start = 'abcd'|     ..{max}|").to.parseAs(repeatedGrammar2(0, "max"));
        expect("start = 'abcd'|{min}..{max}|").to.parseAs(repeatedGrammar2("min", "max"));
        expect("start = 'abcd'|{exact}|     ").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "function", value: "exact" },
          expression: literalAbcd,
          delimiter: null,
        }));
      });

      it("with mixed boundaries", () => {
        expect("start = 'abcd'|2..max|").to.parseAs(repeatedGrammar(2, "max"));
        expect("start = 'abcd'|min..3|").to.parseAs(repeatedGrammar("min", 3));

        expect("start = 'abcd'|2..{max}|").to.parseAs(repeatedGrammar2(2, "max"));
        expect("start = 'abcd'|{min}..3|").to.parseAs(repeatedGrammar2("min", 3));
      });
    });

    describe("with delimiter", () => {
      it("with constant boundaries", () => {
        expect("start = 'abcd'| .. , 'efgh'|").to.parseAs(repeatedGrammar3(0, null));
        expect("start = 'abcd'|0.. , 'efgh'|").to.parseAs(repeatedGrammar3(0, null));
        expect("start = 'abcd'|1.. , 'efgh'|").to.parseAs(repeatedGrammar3(1, null));
        expect("start = 'abcd'|2.. , 'efgh'|").to.parseAs(repeatedGrammar3(2, null));

        expect("start = 'abcd'| ..1, 'efgh'|").to.parseAs(repeatedGrammar3(0, 1));
        expect("start = 'abcd'| ..2, 'efgh'|").to.parseAs(repeatedGrammar3(0, 2));

        expect("start = 'abcd'|2..2, 'efgh'|").to.parseAs(repeatedGrammar3(2, 2));
        expect("start = 'abcd'|2..3, 'efgh'|").to.parseAs(repeatedGrammar3(2, 3));
        expect("start = 'abcd'|3   , 'efgh'|").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "constant", value: 3 },
          expression: literalAbcd,
          delimiter: literalEfgh,
        }));

        expect("start = 'abcd'| ..0, 'efgh'|").to.failToParse();
        expect("start = 'abcd'|0..0, 'efgh'|").to.failToParse();
        expect("start = 'abcd'|0   , 'efgh'|").to.failToParse();
      });

      it("with variable boundaries", () => {
        expect("start = 'abcd'|min..   , 'efgh'|").to.parseAs(repeatedGrammar3("min", null));
        expect("start = 'abcd'|   ..max, 'efgh'|").to.parseAs(repeatedGrammar3(0, "max"));
        expect("start = 'abcd'|min..max, 'efgh'|").to.parseAs(repeatedGrammar3("min", "max"));
        expect("start = 'abcd'|exact, 'efgh'|   ").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "variable", value: "exact" },
          expression: literalAbcd,
          delimiter: literalEfgh,
        }));
      });

      it("with function boundaries", () => {
        expect("start = 'abcd'|{min}..     , 'efgh'|").to.parseAs(repeatedGrammar4("min", null));
        expect("start = 'abcd'|     ..{max}, 'efgh'|").to.parseAs(repeatedGrammar4(0, "max"));
        expect("start = 'abcd'|{min}..{max}, 'efgh'|").to.parseAs(repeatedGrammar4("min", "max"));
        expect("start = 'abcd'|{exact},      'efgh'|").to.parseAs(oneRuleGrammar({
          type: "repeated",
          min: null,
          max: { type: "function", value: "exact" },
          expression: literalAbcd,
          delimiter: literalEfgh,
        }));
      });

      it("with mixed boundaries", () => {
        expect("start = 'abcd'|2..max, 'efgh'|").to.parseAs(repeatedGrammar3(2, "max"));
        expect("start = 'abcd'|min..3, 'efgh'|").to.parseAs(repeatedGrammar3("min", 3));

        expect("start = 'abcd'|2..{max}, 'efgh'|").to.parseAs(repeatedGrammar4(2, "max"));
        expect("start = 'abcd'|{min}..3, 'efgh'|").to.parseAs(repeatedGrammar4("min", 3));
      });
    });
  });

  // Canonical RuleReferenceExpression is "a".
  it("parses RuleReferenceExpression", () => {
    expect("start = a").to.parseAs(ruleRefGrammar("a"));

    expect("start = a\n=").to.failToParse();
    expect("start = a\n'abcd'\n=").to.failToParse();
    expect("start = a.\x00").to.failToParse();
  });

  // Canonical SemanticPredicateExpression is "!{ code }".
  it("parses SemanticPredicateExpression", () => {
    expect("start = !\n{ code }").to.parseAs(oneRuleGrammar(semanticNot));
    expect("start = !{").to.failToParse();
    expect("start = &{").to.failToParse();
    expect("start = &{ ").to.failToParse();
    expect("start = &{  ").to.failToParse();
    expect("start = &{{").to.failToParse();
    expect("start = &{{ ").to.failToParse();
    expect("start = &{{  ").to.failToParse();
    expect("start = &{{   ").to.failToParse();
    expect("start = &{{}").to.failToParse();
    expect("start = &{{} ").to.failToParse();
    expect("start = &{{}  ").to.failToParse();
    expect("start = &{{}{}").to.failToParse();
    expect("start = &{{}{} ").to.failToParse();
    expect("start = &{{}{}  ").to.failToParse();
    expect("start = &{{}{}{").to.failToParse();
    expect("start = &{{}{}{ ").to.failToParse();
    expect("start = &{{}{}{  ").to.failToParse();
  });

  // Canonical SemanticPredicateOperator is "!".
  it("parses SemanticPredicateOperator", () => {
    expect("start = &{ code }").to.parseAs(oneRuleGrammar(semanticAnd));
    expect("start = !{ code }").to.parseAs(oneRuleGrammar(semanticNot));
  });

  it("parses SourceCharacter", () => {
    // Correct surrogates; this produces two UTF-16 code units (2 "chars").
    expect("start = '\u{1F4A9}' // \u{1F4A9}").to.parseAs(literalGrammar("\u{1F4A9}", false));
    expect("start = \"\u{1F4A9}\" // \u{1F4A9}").to.parseAs(literalGrammar("\u{1F4A9}", false));
    // Lone surrogates
    expect("start = '\u{d83d}' // \u{d83d}").to.parseAs(literalGrammar("\u{d83d}", false));
    expect("start = '\u{dca9}' // \u{dca9}").to.parseAs(literalGrammar("\u{dca9}", false));
    // Backwards
    expect("start = '\u{dca9}\u{d83d}' // \u{dca9}\u{d83d}").to.parseAs(literalGrammar("\u{dca9}\u{d83d}", false));
  });

  // Canonical WhiteSpace is " ".
  it("parses WhiteSpace", () => {
    expect("start =\t'abcd'").to.parseAs(trivialGrammar);
    expect("start =\v'abcd'").to.parseAs(trivialGrammar);
    expect("start =\f'abcd'").to.parseAs(trivialGrammar);
    expect("start = 'abcd'").to.parseAs(trivialGrammar);
    expect("start =\u00A0'abcd'").to.parseAs(trivialGrammar);
    expect("start =\uFEFF'abcd'").to.parseAs(trivialGrammar);
    expect("start =\u1680'abcd'").to.parseAs(trivialGrammar);
  });

  // Canonical LineTerminator is "\n".
  it("parses LineTerminator", () => {
    expect("start = '\n'").to.failToParse();
    expect("start = '\r'").to.failToParse();
    expect("start = '\u2028'").to.failToParse();
    expect("start = '\u2029'").to.failToParse();
  });

  // Canonical LineTerminatorSequence is "\r\n".
  it("parses LineTerminatorSequence", () => {
    expect("start =\n'abcd'").to.parseAs(trivialGrammar);
    expect("start =\r\n'abcd'").to.parseAs(trivialGrammar);
    expect("start =\r'abcd'").to.parseAs(trivialGrammar);
    expect("start =\u2028'abcd'").to.parseAs(trivialGrammar);
    expect("start =\u2029'abcd'").to.parseAs(trivialGrammar);
  });

  // Canonical Comment is "/* comment */".
  it("parses Comment", () => {
    expect("start =// comment\n'abcd'").to.parseAs(trivialGrammar);
    expect("start =/* comment */'abcd'").to.parseAs(trivialGrammar);
  });

  // Canonical MultiLineComment is "/* comment */".
  it("parses MultiLineComment", () => {
    expect("start =/**/'abcd'").to.parseAs(trivialGrammar);
    expect("start =/*a*/'abcd'").to.parseAs(trivialGrammar);
    expect("start =/*abc*/'abcd'").to.parseAs(trivialGrammar);

    expect("start =/**/*/'abcd'").to.failToParse();
    expect("start = /*").to.failToParse();
    expect("start = /* ").to.failToParse();
    expect("start = /*  ").to.failToParse();
    expect("start = 'foo'/*").to.failToParse();
    expect("start = 'foo'/* ").to.failToParse();
    expect("start = 'foo'/*  ").to.failToParse();
  });

  // Canonical MultiLineCommentNoLineTerminator is "/* comment */".
  it("parses MultiLineCommentNoLineTerminator", () => {
    expect("a = 'abcd'/**/\r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd'/*a*/\r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd'/*abc*/\r\nb = 'efgh'").to.parseAs(twoRuleGrammar);

    expect("a = 'abcd'/**/*/\r\nb = 'efgh'").to.failToParse();
    expect("a = 'abcd'/*\n*/\r\nb = 'efgh'").to.failToParse();
  });

  // Canonical SingleLineComment is "// comment".
  it("parses SingleLineComment", () => {
    expect("start =//\n'abcd'").to.parseAs(trivialGrammar);
    expect("start =//a\n'abcd'").to.parseAs(trivialGrammar);
    expect("start =//abc\n'abcd'").to.parseAs(trivialGrammar);

    expect("//").to.failToParse();
    expect("// ").to.failToParse();
    expect("//  ").to.failToParse();
    expect("start =//\n@\n'abcd'").to.failToParse();
  });

  // Canonical Identifier is "a".
  it("parses Identifier", () => {
    expect("start = a:'abcd'").to.parseAs(oneRuleGrammar(labeledAbcd));
  });

  // Canonical IdentifierName is "a".
  it("parses IdentifierName", () => {
    expect("start = a").to.parseAs(ruleRefGrammar("a"));
    expect("start = ab").to.parseAs(ruleRefGrammar("ab"));
    expect("start = abcd").to.parseAs(ruleRefGrammar("abcd"));
  });

  // Canonical IdentifierStart is "a".
  it("parses IdentifierStart", () => {
    expect("start = a").to.parseAs(ruleRefGrammar("a"));
    expect("start = $").to.failToParse();
    expect("$start = a").to.failToParse();
    expect("start = a$b").to.parseAs(ruleRefGrammar("a$b"));
    expect("start = _").to.parseAs(ruleRefGrammar("_"));
    expect("start = \\u0061").to.parseAs(ruleRefGrammar("a"));

    expect("start = \\").to.failToParse();
  });

  // Canonical IdentifierPart is "a".
  it("parses IdentifierPart", () => {
    expect("start = aa").to.parseAs(ruleRefGrammar("aa"));
    expect("start = a\u0300").to.parseAs(ruleRefGrammar("a\u0300"));
    expect("start = a0").to.parseAs(ruleRefGrammar("a0"));
    expect("start = a\u203F").to.parseAs(ruleRefGrammar("a\u203F"));
    expect("start = a\u200C").to.parseAs(ruleRefGrammar("a\u200C"));
    expect("start = a\u200D").to.parseAs(ruleRefGrammar("a\u200D"));
  });

  // Unicode rules and reserved word rules are not tested.

  // Canonical LiteralMatcher is "'abcd'".
  it("parses LiteralMatcher", () => {
    expect("start = 'abcd'").to.parseAs(literalGrammar("abcd", false));
    expect("start = 'abcd'i").to.parseAs(literalGrammar("abcd", true));
  });

  // Canonical StringLiteral is "'abcd'".
  it("parses StringLiteral", () => {
    expect("start = \"\"").to.parseAs(literalGrammar("",    false));
    expect("start = \"a\"").to.parseAs(literalGrammar("a",   false));
    expect("start = \"abc\"").to.parseAs(literalGrammar("abc", false));

    expect("start = ''").to.parseAs(literalGrammar("",    false));
    expect("start = 'a'").to.parseAs(literalGrammar("a",   false));
    expect("start = 'abc'").to.parseAs(literalGrammar("abc", false));
  });

  // Canonical DoubleStringCharacter is "a".
  it("parses DoubleStringCharacter", () => {
    expect("start = \"a\"").to.parseAs(literalGrammar("a",  false));
    expect("start = \"\\n\"").to.parseAs(literalGrammar("\n", false));
    expect("start = \"\\\n\"").to.parseAs(literalGrammar("",   false));

    expect("start = \"\"\"").to.failToParse();
    expect("start = \"\\\"").to.failToParse();
    expect("start = \"\n\"").to.failToParse();
  });

  // Canonical SingleStringCharacter is "a".
  it("parses SingleStringCharacter", () => {
    expect("start = 'a'").to.parseAs(literalGrammar("a",  false));
    expect("start = '\\n'").to.parseAs(literalGrammar("\n", false));
    expect("start = '\\\n'").to.parseAs(literalGrammar("",   false));

    expect("start = '''").to.failToParse();
    expect("start = '\\'").to.failToParse();
    expect("start = '\n'").to.failToParse();
  });

  // Canonical CharacterClassMatcher is "[a-d]".
  it("parses CharacterClassMatcher", () => {
    expect("start = []").to.parseAs(
      classGrammar([], false, false)
    );
    expect("start = [a-d]").to.parseAs(
      classGrammar([["a", "d"]], false, false)
    );
    expect("start = [a]").to.parseAs(
      classGrammar(["a"], false, false)
    );
    expect("start = [a-de-hi-l]").to.parseAs(
      classGrammar(
        [["a", "d"], ["e", "h"], ["i", "l"]],
        false,
        false
      )
    );
    expect("start = [^a-d]").to.parseAs(
      classGrammar([["a", "d"]], true, false)
    );
    expect("start = [a-d]i").to.parseAs(
      classGrammar([["a", "d"]], false, true)
    );

    expect("start = [\\\n]").to.parseAs(
      classGrammar([], false, false)
    );

    expect("start = [\u{1F4A9}]").to.parseAs(
      classGrammar(["\u{1F4A9}"], false, false, true)
    );
    expect("start = [\\u{1F4A9}]").to.parseAs(
      classGrammar(["\u{1F4A9}"], false, false, true)
    );
    expect("start = [\u{1F4A9}-\u{1F4B0}]").to.parseAs(
      classGrammar([["\u{1F4A9}", "\u{1F4B0}"]], false, false, true)
    );
    expect("start = [\\u{1F4A9}-\\u{1F4B0}]").to.parseAs(
      classGrammar([["\u{1F4A9}", "\u{1F4B0}"]], false, false, true)
    );
    expect("start = [\\u{g}]").to.failToParse();
    expect("start = [\\u{1g}]").to.failToParse();
    expect("start = [\\u{12g}]").to.failToParse();
    expect("start = [\\u{123g}]").to.failToParse();
    expect("start = [\\xgg]").to.failToParse();
    expect("start = [a]uu").to.failToParse();
    expect("start = [a]ii").to.failToParse();
    expect("start = [a]iui").to.failToParse();
    expect("start = [a]uiu").to.failToParse();
    expect("start = [^a]u").to.parseAs(
      classGrammar(["a"], true, false, true)
    );
    expect("start = [^a]ui").to.parseAs(
      classGrammar(["a"], true, true, true)
    );
    expect("start = [^a]iu").to.parseAs(
      classGrammar(["a"], true, true, true)
    );
    expect("start = [^]u").to.parseAs(
      classGrammar([["\ud800", "\udfff"]], true, false, true)
    );
    expect("start = [\\p{ASCII}]").to.parseAs(
      classGrammar([{
        type: "classEscape",
        value: "p{ASCII}",
        unicode: true,
      }], false, false, true)
    );
    expect("start = [\\P{ASCII}]").to.parseAs(
      classGrammar([{
        type: "classEscape",
        value: "P{ASCII}",
        unicode: true,
      }], false, false, true)
    );
    expect("start = [\\p{gc=Nd}]").to.parseAs(
      classGrammar([{
        type: "classEscape",
        value: "p{gc=Nd}",
        unicode: true,
      }], false, false, true)
    );
    expect("start = [\\p{Script=New_Tai_Lue}]").to.parseAs(
      classGrammar([{
        type: "classEscape",
        value: "p{Script=New_Tai_Lue}",
        unicode: true,
      }], false, false, true)
    );
    expect("start = [\\p]").to.failToParse();
    expect("start = [\\p{]").to.failToParse();
    expect("start = [\\p{a]").to.failToParse();
    expect("start = [\\p{a=]").to.failToParse();
    expect("start = [\\p{a=b]").to.failToParse();
    expect("start = [\\p{\u0661}]").to.failToParse();
    expect("start = [\\p{foooo}]u").to.failToParse();
  });

  // Canonical ClassCharacterRange is "a-d".
  it("parses ClassCharacterRange", () => {
    expect("start = [a-d]").to.parseAs(classGrammar([["a", "d"]], false, false));

    expect("start = [a-a]").to.parseAs(classGrammar([["a", "a"]], false, false));
    expect("start = [b-a]").to.failToParse({
      message: "Invalid character range: b-a.",
    });
    expect("start = [b-").to.failToParse();
  });

  // Canonical ClassCharacter is "a".
  it("parses ClassCharacter", () => {
    expect("start = [a]").to.parseAs(classGrammar(["a"],  false, false));
    expect("start = [\\n]").to.parseAs(classGrammar(["\n"], false, false));
    expect("start = [\\\n]").to.parseAs(classGrammar([],     false, false));

    expect("start = []]").to.failToParse();
    expect("start = [\\]").to.failToParse();
    expect("start = [\n]").to.failToParse();
  });

  // Canonical LineContinuation is "\\\n".
  it("parses LineContinuation", () => {
    expect("start = '\\\r\n'").to.parseAs(literalGrammar("", false));
  });

  // Canonical EscapeSequence is "n".
  it("parses EscapeSequence", () => {
    expect("start = '\\n'").to.parseAs(literalGrammar("\n",     false));
    expect("start = '\\0'").to.parseAs(literalGrammar("\x00",   false));
    expect("start = '\\xFF'").to.parseAs(literalGrammar("\xFF",   false));
    expect("start = '\\uFFFF'").to.parseAs(literalGrammar("\uFFFF", false));
    expect("start = '\\c'").to.parseAs(literalGrammar("c", false));

    expect("start = '\\09'").to.failToParse();
    expect("start = '\\").to.failToParse();
  });

  // Canonical CharacterEscapeSequence is "n".
  it("parses CharacterEscapeSequence", () => {
    expect("start = '\\n'").to.parseAs(literalGrammar("\n", false));
    expect("start = '\\a'").to.parseAs(literalGrammar("a",  false));
  });

  // Canonical SingleEscapeCharacter is "n".
  it("parses SingleEscapeCharacter", () => {
    expect("start = '\\''").to.parseAs(literalGrammar("'",  false));
    expect("start = '\\\"'").to.parseAs(literalGrammar("\"", false));
    expect("start = '\\\\'").to.parseAs(literalGrammar("\\", false));
    expect("start = '\\b'").to.parseAs(literalGrammar("\b", false));
    expect("start = '\\f'").to.parseAs(literalGrammar("\f", false));
    expect("start = '\\n'").to.parseAs(literalGrammar("\n", false));
    expect("start = '\\r'").to.parseAs(literalGrammar("\r", false));
    expect("start = '\\t'").to.parseAs(literalGrammar("\t", false));
    expect("start = '\\v'").to.parseAs(literalGrammar("\v", false));
  });

  // Canonical NonEscapeCharacter is "a".
  it("parses NonEscapeCharacter", () => {
    expect("start = '\\a'").to.parseAs(literalGrammar("a", false));

    // The negative predicate is impossible to test with Peggy grammar
    // structure.
  });

  // The EscapeCharacter rule is impossible to test with Peggy grammar
  // structure.

  // Canonical HexEscapeSequence is "xFF".
  it("parses HexEscapeSequence", () => {
    expect("start = '\\xFF'").to.parseAs(literalGrammar("\xFF", false));
    expect("start = '\\x").to.failToParse();
    expect("start = '\\xF").to.failToParse();
  });

  // Canonical UnicodeEscapeSequence is "uFFFF".
  it("parses UnicodeEscapeSequence", () => {
    expect("start = '\\uFFFF'").to.parseAs(literalGrammar("\uFFFF", false));
    expect("start = '\\u").to.failToParse();
    expect("start = '\\uF").to.failToParse();
    expect("start = '\\uFF").to.failToParse();
    expect("start = '\\uFFF").to.failToParse();
  });

  // Digit rules are not tested.

  // Canonical AnyMatcher is ".".
  it("parses AnyMatcher", () => {
    expect("start = .").to.parseAs(anyGrammar());
  });

  // Canonical CodeBlock is "{ code }".
  it("parses CodeBlock", () => {
    expect("start = 'abcd' { code }").to.parseAs(actionGrammar(" code "));
  });

  // Canonical Code is " code ".
  it("parses Code", () => {
    expect("start = 'abcd' {a}").to.parseAs(actionGrammar("a"));
    expect("start = 'abcd' {abc}").to.parseAs(actionGrammar("abc"));
    expect("start = 'abcd' {{a}}").to.parseAs(actionGrammar("{a}"));
    expect("start = 'abcd' {{a}{b}{c}}").to.parseAs(actionGrammar("{a}{b}{c}"));

    expect("start = 'abcd' {{}").to.failToParse();
    expect("start = 'abcd' {}}").to.failToParse();
  });

  // Unicode character category rules and token rules are not tested.

  // Canonical __ is "\n".
  it("parses __", () => {
    expect("start ='abcd'").to.parseAs(trivialGrammar);
    expect("start = 'abcd'").to.parseAs(trivialGrammar);
    expect("start =\r\n'abcd'").to.parseAs(trivialGrammar);
    expect("start =/* comment */'abcd'").to.parseAs(trivialGrammar);
    expect("start =   'abcd'").to.parseAs(trivialGrammar);
  });

  // Canonical _ is " ".
  it("parses _", () => {
    expect("a = 'abcd'\r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd' \r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd'/* comment */\r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd'   \r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
  });

  // Canonical EOS is ";".
  it("parses EOS", () => {
    expect("a = 'abcd'\n;b = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd' \r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd' // comment\r\nb = 'efgh'").to.parseAs(twoRuleGrammar);
    expect("a = 'abcd'\nb = 'efgh'").to.parseAs(twoRuleGrammar);
  });

  // Canonical EOF is the end of input.
  it("parses EOF", () => {
    expect("start = 'abcd'\n").to.parseAs(trivialGrammar);
  });

  it("generates codeLocation / nameLocation / labelLocation", () => {
    const result = parser.parse(`
{{
  const foo = 12;
}}
{
  const bar = 13;
}
a = label:'abcd' &{ return true; } !{ return false; } { return 'so true'; }
b = @LABEL:'efgh'
c = @'ijkl'
`);
    expect(result).to.eql({
      type: "grammar",
      imports: [],
      topLevelInitializer: {
        type: "top_level_initializer",
        code: "\n  const foo = 12;\n",
        codeLocation: {
          source: undefined,
          start: { offset: 3, line: 2, column: 3 },
          end: { offset: 22, line: 4, column: 1 },
        },
        location: {
          source: undefined,
          start: { offset: 1, line: 2, column: 1 },
          end: { offset: 25, line: 5, column: 1 },
        },
      },
      initializer: {
        type: "initializer",
        code: "\n  const bar = 13;\n",
        codeLocation: {
          source: undefined,
          start: { offset: 26, line: 5, column: 2 },
          end: { offset: 45, line: 7, column: 1 },
        },
        location: {
          source: undefined,
          start: { offset: 25, line: 5, column: 1 },
          end: { offset: 47, line: 8, column: 1 },
        },
      },
      rules: [
        {
          type: "rule",
          name: "a",
          nameLocation: {
            source: undefined,
            start: { offset: 47, line: 8, column: 1 },
            end: { offset: 48, line: 8, column: 2 },
          },
          expression: {
            type: "action",
            expression: {
              type: "sequence",
              elements: [
                {
                  type: "labeled",
                  label: "label",
                  labelLocation: {
                    source: undefined,
                    start: { offset: 51, line: 8, column: 5 },
                    end: { offset: 56, line: 8, column: 10 },
                  },
                  expression: {
                    type: "literal",
                    value: "abcd",
                    ignoreCase: false,
                    location: {
                      source: undefined,
                      start: { offset: 57, line: 8, column: 11 },
                      end: { offset: 63, line: 8, column: 17 },
                    },
                  },
                  location: {
                    source: undefined,
                    start: { offset: 51, line: 8, column: 5 },
                    end: { offset: 63, line: 8, column: 17 },
                  },
                },
                {
                  type: "semantic_and",
                  code: " return true; ",
                  codeLocation: {
                    source: undefined,
                    start: { offset: 66, line: 8, column: 20 },
                    end: { offset: 80, line: 8, column: 34 },
                  },
                  location: {
                    source: undefined,
                    start: { offset: 64, line: 8, column: 18 },
                    end: { offset: 81, line: 8, column: 35 },
                  },
                },
                {
                  type: "semantic_not",
                  code: " return false; ",
                  codeLocation: {
                    source: undefined,
                    start: { offset: 84, line: 8, column: 38 },
                    end: { offset: 99, line: 8, column: 53 },
                  },
                  location: {
                    source: undefined,
                    start: { offset: 82, line: 8, column: 36 },
                    end: { offset: 100, line: 8, column: 54 },
                  },
                },
              ],
              location: {
                source: undefined,
                start: { offset: 51, line: 8, column: 5 },
                end: { offset: 100, line: 8, column: 54 },
              },
            },
            code: " return 'so true'; ",
            codeLocation: {
              source: undefined,
              start: { offset: 102, line: 8, column: 56 },
              end: { offset: 121, line: 8, column: 75 },
            },
            location: {
              source: undefined,
              start: { offset: 51, line: 8, column: 5 },
              end: { offset: 122, line: 8, column: 76 },
            },
          },
          location: {
            source: undefined,
            start: { offset: 47, line: 8, column: 1 },
            end: { offset: 123, line: 9, column: 1 },
          },
        },
        {
          type: "rule",
          name: "b",
          nameLocation: {
            source: undefined,
            start: { offset: 123, line: 9, column: 1 },
            end: { offset: 124, line: 9, column: 2 },
          },
          expression: {
            type: "sequence",
            elements: [{
              type: "labeled",
              label: "LABEL",
              labelLocation: {
                source: undefined,
                start: { offset: 128, line: 9, column: 6 },
                end: { offset: 133, line: 9, column: 11 },
              },
              pick: true,
              expression: {
                type: "literal",
                value: "efgh",
                ignoreCase: false,
                location: {
                  source: undefined,
                  start: { offset: 134, line: 9, column: 12 },
                  end: { offset: 140, line: 9, column: 18 },
                },
              },
              location: {
                source: undefined,
                start: { offset: 127, line: 9, column: 5 },
                end: { offset: 140, line: 9, column: 18 },
              },
            }],
            location: {
              source: undefined,
              start: { offset: 127, line: 9, column: 5 },
              end: { offset: 140, line: 9, column: 18 },
            },
          },
          location: {
            source: undefined,
            start: { offset: 123, line: 9, column: 1 },
            end: { offset: 141, line: 10, column: 1 },
          },
        },
        {
          type: "rule",
          name: "c",
          nameLocation: {
            source: undefined,
            start: { offset: 141, line: 10, column: 1 },
            end: { offset: 142, line: 10, column: 2 },
          },
          expression: {
            type: "sequence",
            elements: [{
              type: "labeled",
              label: null,
              labelLocation: {
                source: undefined,
                start: { offset: 145, line: 10, column: 5 },
                end: { offset: 146, line: 10, column: 6 },
              },
              pick: true,
              expression: {
                type: "literal",
                value: "ijkl",
                ignoreCase: false,
                location: {
                  source: undefined,
                  start: { offset: 146, line: 10, column: 6 },
                  end: { offset: 152, line: 10, column: 12 },
                },
              },
              location: {
                source: undefined,
                start: { offset: 145, line: 10, column: 5 },
                end: { offset: 152, line: 10, column: 12 },
              },
            }],
            location: {
              source: undefined,
              start: { offset: 145, line: 10, column: 5 },
              end: { offset: 152, line: 10, column: 12 },
            },
          },
          location: {
            source: undefined,
            start: { offset: 141, line: 10, column: 1 },
            end: { offset: 153, line: 11, column: 1 },
          },
        },
      ],
      location: {
        source: undefined,
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 153, line: 11, column: 1 },
      },
    });
  });

  it("handles ImportsAndSource", () => {
    const opts = { startRule: "ImportsAndSource", reservedWords: RESERVED_WORDS };

    for (const txt of [
      "",
      "import foo",
      "import 'foo';",
      "import bar, baz from 'foo';",
      "import * boo",
      "import * as ",
      "import * as ;",
      "import {foo",
      "import {foo,",
      "import {foo, bar",
      "import {foo, bar,",
      "import {;",
      "import from;",
      "import * from;",
      "import {foo} from;",
      "import {foo as}",
    ]) {
      expect(() => parser.parse(txt, opts)).to.not.throw();
    }

    for (const txt of [
      "import while from 'bar'",
    ]) {
      expect(() => parser.parse(txt, opts)).to.throw();
    }
  });

  it("handles peg$library", () => {
    const res = parser.parse("foo", { peg$library: true });
    expect(typeof res.peg$throw).to.eql("function");
    delete res.peg$throw;
    expect(res).to.eql({
      peg$result: {},
      peg$currPos: 0,
      peg$FAILED: {},
      peg$maxFailExpected: [
        { type: "other", description: "whitespace" },
        { type: "other", description: "end of line" },
        { type: "other", description: "comment" },
        { type: "other", description: "string" },
        { type: "literal", text: "=", ignoreCase: false },
      ],
      peg$maxFailPos: 3,
      peg$success: false,
    });
  });
});
