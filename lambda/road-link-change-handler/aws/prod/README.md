# Tuotantoympäristön pystytys

## Siirry projektin juuresta lambda-funktion omaan kansioon
```
cd lambda/road-link-change-handler
```

## AWS CLI komennot

*HUOM.* Tarkista ennen jokaista create-stack komentoa parametritiedostojen sisältö.

### 1 Luo ECR repository [tuotantotili]
```
aws cloudformation create-stack \
--stack-name [esim. digiroad2-road-link-change-lambda-ecr] \
--template-body file://aws/cloudformation/ecr/prod-ecr.yaml \
--parameters file://aws/prod/ecr-parameter.json \
--tags file://aws/prod/tags.json
```

### 2 Luo tarvittavat resurssit [tuotantotili]
```
aws cloudformation create-stack \
--stack-name [esim. digiroad2-road-link-change-handler] \
--template-body file://aws/cloudformation/lambda-resources.yaml \
--parameters file://aws/prod/lambda-resources.json \
--tags file://aws/prod/tags.json \
--capabilities CAPABILITY_NAMED_IAM
```

### 3 Luo tuotanto pipeline [kehitystili]
```
aws cloudformation create-stack \
--stack-name [esim. prod-digiroad2-road-link-change-pipeline] \ 
--template-body file://aws/cloudformation/cicd/prod-cicd-stack.yaml \
--parameters file://aws/prod/cicd-parameter.json \
--tags file://aws/prod/tags.json \
--capabilities CAPABILITY_NAMED_IAM
```

### 4a Laita lambdan event ajastus pois päältä [tuotantotili]
Disabloi lambdan käynnistävä EventBridge sääntö.
*Huom.* Varmista että eventin nimi vastaa lambda-resources.yaml:lla luotua
```
aws events disable-rule --name prod-digiroad2-start-road-link-change-handler-event
```

### 4b Laita lambdan event ajastus päälle [tuotantotili]
Laita lambdan käynnistävä EventBridge sääntö takaisin päälle siinä vaiheessa, kun lambdan toteutus on valmis.
*Huom.* Varmista että eventin nimi vastaa lambda-resources.yaml:lla luotua
```
aws events enable-rule --name prod-digiroad2-start-road-link-change-handler-event
```

**Aja vaiheessa 3 luotu pipeline, joka puskee ensimmäisen imagen ECR:ään**


# Kehitysympäristön päivitys

## AWS CLI komennot

*HUOM.* Tarkista ennen jokaista update-stack komentoa parametritiedostojen sisältö.

### Päivitä tuotanto pipeline [kehitystili]
```
aws cloudformation update-stack \
--stack-name [esim. digiroad2-road-link-change-pipeline] \ 
--template-body file://aws/cloudformation/cicd/prod-cicd-stack.yaml \
--parameters file://aws/prod/cicd-parameter.json \
--tags file://aws/prod/tags.json \
--capabilities CAPABILITY_NAMED_IAM
```

### Päivitä resurssit [tuotantotili]
*Huom.* Korvaa parametrit sisältävän tiedoston parametri "ECRImageTag" uudella ECRImageTag parametrin arvolla jos lambdan koodissa on tapahtunut muutoksia.
```
aws cloudformation update-stack \
--stack-name [esim. digiroad2-road-link-change-handler] \
--template-body file://aws/cloudformation/lambda-resources.yaml \
--parameters file://aws/prod/lambda-resources.json \
--capabilities CAPABILITY_NAMED_IAM
```
Lisää komentoon mukaan *--tags file://aws/prod/tags.json* mikäli halutaan päivittää myös tagit.
