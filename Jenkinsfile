pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timestamps()
    }

    triggers {
        pollSCM('* * * * *')
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

        stage('Deploy') {
            steps {
                sh '''
                    ssh -i "$HOME/.ssh/id_ed25519" \
                      -o BatchMode=yes \
                      -o StrictHostKeyChecking=yes \
                      inhwan@192.168.0.210 \
                      'bash /home/inhwan/apps/pentaworks/deploy/refresh-and-deploy.sh'
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
