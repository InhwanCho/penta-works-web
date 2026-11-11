pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    triggers {
        // GitHub Repository webhook: POST /github-webhook/
        githubPush()
    }

    stages {
        stage('Checkout dev') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/dev']],
                    userRemoteConfigs: [[url: 'https://github.com/InhwanCho/penta-works-web.git']]
                ])
            }
        }

        stage('Deploy dev') {
            steps {
                sh '''
                    ssh -i "$HOME/.ssh/id_ed25519" \
                      -o BatchMode=yes \
                      -o StrictHostKeyChecking=yes \
                      inhwan@192.168.0.210 \
                      'bash -s -- dev' < deploy/refresh-and-deploy.sh
                '''
            }
        }
    }

    post {
        always {
            deleteDir()
        }
    }
}
