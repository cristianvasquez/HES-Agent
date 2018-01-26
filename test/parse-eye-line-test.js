

/**
 * Examples in fluid
 */
 let fluid_examples = [
 'eye "$@" --n3 http://josd.github.io/fluid/3outof5/sample.n3 --query http://josd.github.io/fluid/3outof5/query.n3 > answer.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/bi/biP.n3 --query http://josd.github.io/fluid/bi/biQ.n3 > biE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/bmi/bmi_instances.n3 --n3 http://josd.github.io/fluid/bmi/bmi_rules.n3 --n3 http://josd.github.io/fluid/bmi/weightStatus_rules.n3 --n3 http://josd.github.io/fluid/bmi/age_rules_backward.n3 --query http://josd.github.io/fluid/bmi/bmi_query.n3 > bmi_proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/bmt/1tt1.n3 --n3 http://josd.github.io/fluid/bmt/1tt2.n3 --n3 http://josd.github.io/fluid/bmt/1tt3.n3 --n3 http://josd.github.io/fluid/bmt/1tt4.n3 --n3 http://josd.github.io/fluid/bmt/1tt5.n3 --n3 http://josd.github.io/fluid/bmt/1tt6.n3 --n3 http://josd.github.io/fluid/bmt/1tt7.n3 --n3 http://josd.github.io/fluid/bmt/1tt8.n3 --n3 http://josd.github.io/fluid/bmt/1tt9.n3 --n3 http://josd.github.io/fluid/bmt/1tt10.n3 --query http://josd.github.io/fluid/bmt/query.n3 > 10tt_proof.n3',
 'eye "$@" --hmac-key k123 --n3 http://josd.github.io/fluid/crypto/cryptoP.n3 --pass > crypto-proof.n3',
 'eye "$@" --turtle http://josd.github.io/fluid/cs/data-001.n3 --n3 http://josd.github.io/fluid/cs/rules-001.n3 --query http://josd.github.io/fluid/cs/query-001.n3 > proof-001.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/de/de.n3 --n3 http://josd.github.io/fluid/de/deA.n3 --query http://josd.github.io/fluid/de/deQ.n3 > deE.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/dp/dp.n3 --query http://josd.github.io/fluid/dp/dpQ.n3 > dpE.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/dpe/dpe_theory.n3 --n3 http://josd.github.io/fluid/dpe/dpe_assumption.n3 --query http://josd.github.io/fluid/dpe/dpe_query.n3 > dpe_proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/dt/test-facts.n3 --n3 http://josd.github.io/fluid/dt/test-dt-1000.n3 --query http://josd.github.io/fluid/dt/test-query.n3 > test-proof-1000.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/easter/easterP.n3 --query http://josd.github.io/fluid/easter/easterF.n3 > easterE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/einstein/einstein.n3 --query http://josd.github.io/fluid/einstein/einsteinQ.n3 > einsteinE.n3',
 'eye "$@" --nope --n3 http://josd.github.io/fluid/equation4/polynomial.n3 --query http://josd.github.io/fluid/equation4/query.n3 > result.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/fcm/fcm-plugin.n3 --n3 http://josd.github.io/fluid/fcm/fl-rules.n3 --n3 http://josd.github.io/fluid/fcm/example001P.n3 --n3 http://josd.github.io/fluid/fcm/example002P.n3 --query http://josd.github.io/fluid/fcm/example003Q.n3 > fcm_proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/fgcm/fgcm-plugin.n3 --n3 http://josd.github.io/fluid/fcm/fl-rules.n3 --n3 http://josd.github.io/fluid/fgcm/patient.n3 --n3 http://josd.github.io/fluid/fgcm/fgcm-model.n3 --query http://josd.github.io/fluid/fgcm/fgcm-query.n3 > fgcm_proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/fib/fib.n3 --query http://josd.github.io/fluid/fib/fibQ.n3 > fibE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/gedcom/gedcom-facts.n3 --n3 http://josd.github.io/fluid/gedcom/gedcom-relations.n3 --n3 http://josd.github.io/fluid/gedcom/rpo-rules.n3 --query http://josd.github.io/fluid/gedcom/gedcom-filter.n3 > gedcom-proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/glass/test.n3 --query http://josd.github.io/fluid/glass/testQ.n3 > testE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/graph/graph.axiom.n3 --n3 http://josd.github.io/fluid/graph/rpo-rules.n3 --query http://josd.github.io/fluid/graph/graph.filter.n3 > graph.proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/hanoi/hanoi.n3 --pass > hanoiE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/image/year.n3 --n3 http://josd.github.io/fluid/image/easter.n3 --image ype.pvm',
 'eye "$@" --no-genid --n3 http://josd.github.io/fluid/iq/iq.n3 --pass-all > iq_proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/lldm/lldmD.n3 --n3 http://josd.github.io/fluid/lldm/lldmP.n3 --query http://josd.github.io/fluid/lldm/lldmF.n3 > lldmE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/medic/medic.n3 --query http://josd.github.io/fluid/medic/medicF.n3 > medicE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/mmln/mmln-gv-example.n3 --n3 http://josd.github.io/fluid/mmln/mmln-gv-mln.n3 --n3 http://josd.github.io/fluid/mmln/mmln-plugin.n3 --query http://josd.github.io/fluid/mmln/mmln-gv-query.n3 > mmln-gv-proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/nbbn/nbbn-plugin.n3 --n3 http://josd.github.io/fluid/nbbn/nbbn-model.n3 --query http://josd.github.io/fluid/nbbn/nbbn-query.n3 > nbbn_proof.n3',
 'eye "$@" --strict --no-numerals --turtle http://josd.github.io/fluid/numeral/numeral.n3 --pass > numeral_proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/pi/pi.n3 --query http://josd.github.io/fluid/pi/pi-query.n3 > pi-proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/pptbank/bankSW.n3 --n3 http://josd.github.io/fluid/pptbank/checking.n3 --query http://josd.github.io/fluid/pptbank/query.n3 > proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/resto/resto.n3 --query http://josd.github.io/fluid/resto/restoG.n3 > resto-proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/restpath/initial.n3 --n3 http://josd.github.io/fluid/restpath/path-9-3.n3 --query http://josd.github.io/fluid/restpath/goal.n3 > path-9-3-proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/rif/rifP.n3 --query http://josd.github.io/fluid/rif/rifQ.n3 > rifE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/rpo/food-example.n3 --n3 http://josd.github.io/fluid/rpo/food.n3 --n3 http://josd.github.io/fluid/rpo/rdfs-subClassOf.n3 --query http://josd.github.io/fluid/rpo/food-query.n3 > food-proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/rs/randomsample-rule.n3 --query http://josd.github.io/fluid/rs/randomsample-query.n3 > randomsample-proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/skos/skos-mapping-sample-snomed-icd10.n3 --n3 http://josd.github.io/fluid/skos/skos-mapping-validation-rules.n3 --query http://josd.github.io/fluid/skos/skos-mapping-validation-query.n3 > skos_mv_proof.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/socrates/socrates.n3 --query http://josd.github.io/fluid/socrates/socratesF.n3 > socrates_proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/tak/tak.n3 --query http://josd.github.io/fluid/tak/takQ.n3 > takE.n3',
 'eye "$@" --turtle http://josd.github.io/fluid/tfcontext/data-001.n3 --n3 http://josd.github.io/fluid/tfcontext/rules-001.n3 --query http://josd.github.io/fluid/tfcontext/query-001.n3 > proof-001.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/turing/turing.n3 --query http://josd.github.io/fluid/turing/turingQ.n3 > turing_proof.n3',
 'eye "$@" --tactic limited-answer 1 --n3 http://josd.github.io/fluid/usm/usmP.n3 --query http://josd.github.io/fluid/usm/usmQ.n3 > usmE.n3',
 'eye "$@" --n3 http://josd.github.io/fluid/utf8/utf8.n3 --pass > utf8_proof.n3'
];

const reasoning = require('../server/reasoning');

for (line of fluid_examples) {
    reasoning.optionsFromCommand(line);
}